const Socket = Npm.require('net').Socket;
const Future = Npm.require('fibers/future');

Galil.Connections._ensureIndex({ name: 1 }, { unique: 1 });

Galil._commands = new Socket();
Galil._messages = new Socket();

/**
 * Sets up a socket to be used with the Galil controller.
 *
 * @module Galil
 * @function Galil#_createConnection
 * @private
 *
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {net.Socket} socket the socket to attempt a connection on.
 *
 * @throws Meteor.Error if there is no primary device in the database.
 * @throws MongoError if `name` is not unique
 * @throws MatchError if `name` is not a string.
 *
 * @returns {net.Socket} a new configured TCP socket
 * @example
 */
Galil._createConnection = function(name, socket) {
  check(name, String);
  check(socket, Socket);

  const retryTimer = 5000;
  const device = this.Devices.findOne({ primary: true });

  if (!device) {
    throw new Meteor.Error(500, 'No devices available');
  }

  socket._name = name;
  socket.removeAllListeners();

  const upserted = this.Connections.upsert({ name: socket._name }, {
    $set: {
      'connection.status': 'connecting',
      'connection.reason': null,
      'connection.retryCount': 0,
      'connection.retryTime': new Date()
    },
    $setOnInsert: {
      'messages': [],
      'tail': []
    }
  });

  if (upserted.insertedId) {
    this.Devices.update(device._id, {
      $addToSet: { connections: upserted.insertedId }
    });
  }

  // keep retrying the connection, until the maximum number of retries is reached.
  // After that happens, it will propogate to the error handler.
  socket.on('close', Meteor.bindEnvironment((hasError) => {
    const conn = this.Connections.findOne({ name: socket._name }).connection;
    if (conn.retryCount <= device.config.maxRetries) {
      Meteor.setTimeout(() => {
        this.Connections.update({ name: socket._name }, {
          $inc: { 'connection.retryCount': 1 },
          $set: {
            'connection.status': 'connecting',
            'connection.retryTime': new Date()
          }
        });
        socket.connect(device.connection);
      }, retryTimer);
    } else {
      this.Connections.update({ name: socket._name }, {
        $set: { 'connection.status': 'failed' }
      });
    }
  }));

  // after max retries is exceeded, use this error handler to set the error code
  socket.on('error', Meteor.bindEnvironment((err) => {
    const conn = this.Connections.findOne({ name: socket._name }).connection;
    this.Connections.update({ name: socket._name }, {
      $set: { 'connection.reason': err.message }
    });
  }));

  // sets the status to connected
  // Resets any error codes and retry counts
  socket.on('connect', Meteor.bindEnvironment(() => {
    this.Connections.update({ name: socket._name }, {
      $set: {
        'connection.status': 'connected',
        'connection.retryCount': 0
      },
      $unset: { 'connection.reason': null }
    });

    // The data listener only needs to be added once connection is established.
    socket.on('data', Meteor.bindEnvironment((data) => {
      let messages = _.chain(data.toString('ascii'))
        .replace(/\n/g, '\r')
        .split(/\r+/)
        .compact()
        .filter(m => !/^(?:\:|\?)$/.test(m))
        .map(s => ({ message: s, timestamp: new Date() })).value();

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

  return socket;
}

Galil._createConnection('commands', Galil._commands);
Galil._createConnection('messages', Galil._messages);

Galil.connect = function () {
  const device = this.Devices.findOne({ primary: true });
  if (!device) {
    throw new Meteor.Error(500, 'No devices available');
  }

  Galil._messages.once('connect', Meteor.bindEnvironment(() => {
    Galil._messages.write(`CF I\r`);
  }));

  Galil._commands.connect(device.connection);
  Galil._messages.connect(device.connection);
};

Meteor.startup(() => Galil.connect());

