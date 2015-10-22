const net = Npm.require('net');
const Future = Npm.require('fibers/future');

Galil._commands = new net.Socket();
Galil._messages = new net.Socket();
/**
 * Set up a socket connection with a specified name and adds event listeners
 * This will upsert a connection into the Galil.Connections table (which, in turn, update the front end reactive vars)
 * Because this is a TCP socket, it cannot be accessed on the front end. Therefore, it will only update the mongo collection.
 * Messages will be pushed to the `messages` field as they are received.
 *
 * @module Galil
 * @function Galil#_createConnection
 * @private
 *
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 *
 * @throws MongoError if `name` is not unique
 * @throws MatchError if `name` is not a string.
 *
 * @returns {net.Socket} a new configured TCP socket
 * @example
 * const newSocket = Galil._createConnection('garbage', Galil.Devices.findOne());
 * newSocket.write(`MG "Hello"\r`);
 */
Galil._createConnection = function(name, socket) {
  check(name, String);
  check(socket, net.Socket);

  const device = this.Devices.findOne({ primary: true });
  socket.removeAllListeners();
  socket._name = name;

  const upserted = this.Connections.upsert({ name: socket._name }, {
    $set: {
      'connection.status': 'connecting',
      'connection.reason': null,
      'connection.retryCount': 0
    },
    $setOnInsert: {
      'messages': [],
      'tail': []
    }
  });

  if (upserted.insertedId) {
    this.Devices.update(device._id, {
      $push: { connections: upserted.insertedId }
    });
  }

  socket.addListener('close', Meteor.bindEnvironment((hasError) => {
    this.Connections.update({ name: socket._name }, {
      $set: { 'connection.status': hasError ? 'failed' : 'offline' }
    });
  }));

  socket.addListener('error', Meteor.bindEnvironment((error) => {
    console.warn(error);
    this.Connections.update({ name: socket._name }, {
      $set: {
        'connection.status': 'failed',
        'connection.reason': error.message,
      },
      $inc: { 'connection.retryCount': 1 }
    });
  }));

  socket.addListener('end', Meteor.bindEnvironment(() => {
    Meteor._debug('End event fired');
  }));

  socket.addListener('connect', Meteor.bindEnvironment(() => {
    this.Connections.update({ name: socket._name }, {
      $set: {
        'connection.status': 'connected',
        'connection.retryCount': 0,          // reset retry count when connection was successful
        'connection.metadata': socket.address()
      },
      $unset: { 'connection.reason': null }
    });

    socket.addListener('data', Meteor.bindEnvironment((data) => {
      let messages = _.compact(data.toString('ascii').replace(/\n/g, '\r').split(/\r+/)).map((s) => ({
        message: s,
        timestamp: new Date()
      }));

      this.Connections.update({
        name: socket._name
      }, {
        $push: {
          messages: {
            $each: messages,
            $sort: { timestamp: 1 },
            $slice: device.config.messageLimit * -1
          }
        },
        $set: { tail: messages }
      });
    }));
  }));

  socket.connect(device.connection);

  return Future.wrap(socket);
}

/**
 * Connects the galil controller
 *
 * @module Galil
 * @method Galil#connect
 */

Galil.connect = function () {
  Galil._createConnection('commands', Galil._commands);
  Galil._createConnection('messages', Galil._messages);
  Galil._messages.write('CF I\r');
};

Galil.disconnect = function () {
  Galil._messages.pause();
  Galil._commands.pause();
}

Meteor.startup(() => Galil.connect());

