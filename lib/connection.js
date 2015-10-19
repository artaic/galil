const net = Npm.require('net');

/**
 * Set up a socket connection with a specified name and adds event listeners
 * This will upsert a connection into the Galil.connections table (which, in turn, update the front end reactive vars)
 * Because this is a TCP socket, it cannot be accessed on the front end. Therefore, it will only update the mongo collection.
 * Messages will be pushed to the `messages` field as they are received.
 *
 * @module Galil
 * @function Galil#_createConnection
 * @private
 *
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {Object} device the device from the Galil.devices collection
 *
 * @throws MongoError if `name` is not unique
 * @throws MatchError if `name` is not a string.
 *
 * @returns {net.Socket} a new configured TCP socket
 * @example
 * const newSocket = Galil._createConnection('garbage', 23, '192.168.1.3');
 * newSocket.write(`MG "Hello"\r`);
 */
Galil._createConnection = function(name, device) {
  check(name, String);
  check(device.connection, Object);
  check(device.connection.port, Number);
  check(device.connection.host, String);

  let socket = new net.Socket();
  socket._name = name;

  this.connections.upsert({ name: socket._name }, {
    $set: {
      'connection.status': 'connecting',
      'connection.reason': null,
      'connection.retryCount': 0
    },
    $setOnInsert: {
      'messages': [],
      'executing': false,
    }
  });

  socket.addListener('close', Meteor.bindEnvironment((hasError) => {
    this.connections.update({ name: socket._name }, {
      $set: { 'connection.status': hasError ? 'failed' : 'offline' }
    });
  }));

  socket.addListener('error', Meteor.bindEnvironment((error) => {
    console.warn(error);
    this.connections.update({ name: socket._name }, {
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
    this.connections.update({ name: socket._name }, {
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

      this.connections.update({
        name: socket._name
      }, {
        $push: {
          messages: {
            $each: messages,
            $sort: { timestamp: 1 },
            $slice: device.config.messageLimit * -1
          }
        },
        $set: { _lastMessage: messages }
      });
    }));
  }));

  socket.connect(device.connection);

  return socket;
}

/**
 * Connects the galil controller
 *
 * @module Galil
 * @method Galil#connect
 */

Galil.connect = function () {
  const activeDevice = Galil.devices.findOne({ primary: true });
};

const activeDevice = Galil.devices.findOne({ primary: true });

Galil._commands = Galil._createConnection('commands', activeDevice);
Galil._messages = Galil._createConnection('messages', activeDevice)
Galil._messages.write('CF I\r');

