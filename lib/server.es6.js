let fs = Npm.require('fs');
let net = Npm.require('net');
let path = Npm.require('path');
let Promise = Npm.require('bluebird');
let EventEmitter = Npm.require('events').EventEmitter;

/**
 * Galil controller server methods
 *
 * @module Server/Galil
 * @extends EventEmitter
 */

let settings = Meteor.settings.galil;

if (!settings) {
  console.warn("You have not added your Galil configuration");
  Meteor.settings.galil = {};
}

Galil.config._connection = {
  port: settings.port,
  host: settings.host,
};
Galil.config._defaultTimeout = settings.defaultTimeout || 60 * 1000;

Object.defineProperties(Galil.config, {
  'connection': {
    get: function () {
      return this._connection;
    },
    set: function (conn) {
      check(conn, Object);
      if (_.has(conn, 'port')) {
        check(conn.port, Number);
        this._connection.port = conn.port;
        Meteor.settings.galil.connection.port = port;
      }
      if (_.has(conn, 'host')) {
        check(conn.host, String)
        this._connection.host = conn.host
        Meteor.settings.galil.connection.host = host;
      }
    }
  },
  'timeout': {
    get: function () {
      return this._defaultTimeout;
    },
    set: function (timeout) {
      check(timeout, Number);
      this._defaultTimeout = timeout;
      Meteor.settings.galil.defaultTimeout = timeout;
    }
  }
});

/**
 * Set up a socket connection
 *
 * @module Server/Galil
 * @method _createConnection
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {Function} onError Because this opens a `net.connect`, onError is passed as the Meteor.bindEnvironment callback
 * @private
 */
Galil._createConnection = function(name, onError = _.noop) {
  check(name, String);

  let socket = net.connect(this.config._connection, () => {
    this.emit('connect', name);
  });

  socket.on('data', Meteor.bindEnvironment((data) => {
    let args = this.parse(data);

    Galil.collection.insert({
      socket: name,
      message: args.join(' ').replace(this.config.parser._delimiter, ''),
      timestamp: new Date,
      type: args[0]
    });

    _.each(args, (arg) => {
      this.emit.apply(this, arg.split(this.config.parser._delimiter));
    });
  }), onError);

  socket.on('error', Meteor.bindEnvironment(function(error) {
    throw new Meteor.Error(500, error.code);
  }), onError);

  return socket;
}

Galil._messages = Galil._createConnection('messages');
Galil._commands = Galil._createConnection('commands');

Galil._messages.write('CF I\r');

/**
 * Execute a command on the galil controller
 * This will lock in execution synchronously with a fiber.
 *
 * @module Server/Galil
 * @method execute
 * @param {String} command the command to execute
 * @returns {String} the name of the routine completed.
 * @example
 * > Galil.execute('Load');
 */
Galil.execute = function(program, seconds) {
  check(program, String);

  let timeout = _.isNumber(seconds) ? seconds : this.config._defaultTimeout;
  let timeoutError = new Meteor.Error('GalilError', 'CommandTimeout');
  var timerId = Meteor.setTimeout(function () {}, timeout);
  let refreshTimer = function (done, data) {
    clearTimeout(timerId);
    timerId = setTimeout(() => done(timeoutError), timeout);
  }

  let resp = Async.runSync((done) => {
    this.on('End', (routine) => {
      done(null, routine)
    });
    this.on('Error', (err) => {
      done(err, null)
    });
    this._commands.write(`XQ#${program}\r`)

    this._messages.addListener('data', refreshTimer.bind(this, done))
    refreshTimer.bind(this, done);
  });

  this._messages.removeListener('data', refreshTimer);

  if (resp.error) throw resp.error;
  return resp.response;
};

/**
 * Sends command to the Galil controller from the server
 *
 * @module Server/Galil
 * @method sendCommand
 * @param {String|Array} command the command to execute
 * @returns {Promise} a promisified response
 * @throws MatchError if not provided an array or string
 * @example
 * // sending a single command
 * > Galil.sendCommand('MG "Hello, world!"');
 * > Galil.collection.find().fetch()
 * [{
 *  socket: 'commands',
 *  message: 'Hello, world!',
 *  timestamp: sometime
 * }]
 *
 * // send a series of commands in sequence
 * > Galil.sendCommand(['MG "Hello, "', 'MG "World!"']);
 * > Galil.collection.find().fetch()
 * [{
 *  socket: 'commands',
 *  message: 'Hello, world!',
 *  timestamp: ISODate()
 * }, {
 *  socket: 'commands',
 *  message: 'Hello, ',
 *  timestamp: ISODate()
 * }, {
 *  socket: 'commands',
 *  message: 'World!',
 *  timestamp: ISODate()
 * }]
 */
Galil.sendCommand = function(command) {
  check(command, String);
  return new Promise((resolve, reject) => {
    this._commands.write(`${command}\r`, 'utf8', () => {
    });
  });
};

/**
 * Send a variety of commands as an array
 *
 * @module Server/Galil
 * @method sendCommands
 * @alias sendCommand
 */
Galil.sendCommands = function() {
  let args = Array.prototype.slice.call(arguments);
  return Promise.each(args, (command) => {
    this.sendCommand(command);
  });
}

Galil.set = function(name, value) {
  this.sendCommand(`${name}=${value}`);
}

Galil.get = function(name) {
  this.sendCommand(`MG ${name}`);
}

Meteor.methods({
  'Galil.execute': Galil.execute.bind(Galil),
  'Galil.sendCommand': Galil.sendCommand.bind(Galil),
  'Galil.sendCommands': Galil.sendCommands.bind(Galil),
  'Galil.set': Galil.set.bind(Galil),
  'Galil.get': Galil.get.bind(Galil)
});
