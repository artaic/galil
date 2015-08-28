let fs = Npm.require('fs');
let net = Npm.require('net');
let path = Npm.require('path');
let Promise = Npm.require('bluebird');
let EventEmitter = Npm.require('events').EventEmitter;

/**
 * Galil controller for server methods
 *
 * @module Server/Galil
 * @extends EventEmitter
 *
 * @property {Object} config                   - the configuration object
 * @property {Object} config.connection        - the connection to the controller
 * @property {Number} config.connection.port   - the port to connect to
 * @property {String} config.connection.host   - the host to connect to
 * @property {Number} config.timeout           - how long to wait on synchronous functions before timing out
 *
 * @author Alex Frazer
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
 * Set up a socket connection with a specified name and adds event listeners
 *
 * @module Server/Galil
 * @method Galil#_createConnection
 *
 * @emits Galil#connect when the socket is connected
 * @emits Galil#close when the socket closes
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {Function} onError Because this opens a `net.connect`, onError is passed as the Meteor.bindEnvironment callback
 * @throws Meteor.Error when the socket responds with an error
 * @returns {net.Socket} a new configured socket
 * @private
 */
Galil._createConnection = function(name, onError=_.noop) {
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
 * If no data is received for a specified amount of time, an error will be thrown.
 *
 * @module Server/Galil
 * @method Galil#execute
 * @param {String} command the command to execute
 * @param {Number} seconds the number of seconds to wait before timing out.
 *
 * @returns {String} the name of the routine completed.
 * @throws GalilError.TimeoutError if the timeout is exceeded.
 * @throws GalilError.CommandError if the command leads to an error on the controller
 * @example
 * Galil.execute('Load', 10000, function (err, subroutine) {
 *   console.log('Loading complete');
 * });
 */
Galil.execute = function(program, seconds) {
  check(program, String);

  let timeout = _.isNumber(seconds) ? seconds * 1000 : this.config._defaultTimeout;
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
 * @method Galil#sendCommand
 * @param {String} command the command to execute
 * @returns {Promise} a promisified response
 * @throws MatchError if not provided an array or string
 * @example
 * Galil.sendCommand('MG "Hello, world!"').then(() => {
 *   console.log(Galil.collection.find().fetch());
 * });
 *
 * [{
 *  socket: 'commands',
 *  message: 'Hello, world!',
 *  timestamp: sometime
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
 * Send multiple commands in a single call.
 *
 * @module Server/Galil
 * @method Galil#sendCommands
 * @param {String} commands pass in as many commands as you'll like and they'll execute in sequence.
 * @returns {Promise} a promise on `each` command
 * @example
 * Galil.sendCommands('MG "Hello"', 'MG "Goodbye"').then(() => {
 *   console.log(Galil.connection.find().fetch());
 * });
 *
 * [{
 *  socket: 'commands',
 *  message: 'Hello',
 *  timestamp: sometime
 * }, {
 *  socket: 'commands',
 *  message: 'Goodbye',
 *  timestamp: sometime
 * }]
 */
Galil.sendCommands = function() {
  let args = Array.prototype.slice.call(arguments);
  return Promise.each(args, (command) => {
    this.sendCommand(command);
  });
}

Meteor.methods({
  'Galil.execute': Galil.execute.bind(Galil),
  'Galil.sendCommand': Galil.sendCommand.bind(Galil),
  'Galil.sendCommands': Galil.sendCommands.bind(Galil),
});
