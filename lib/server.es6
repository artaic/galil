let fs = Npm.require('fs');
let net = Npm.require('net');
let path = Npm.require('path');
let Promise = Npm.require('bluebird');
let EventEmitter = Npm.require('events').EventEmitter;

/**
 * Galil controller server methods
 *
 * @module Galil
 * @extends EventEmitter
 */

let config = ServiceConfiguration.configurations.findOne({ service: 'galil' });

Galil = new EventEmitter();
Galil._port = config ? config.port : null;
Galil._host = config ? config.host : null;

Object.defineProperties(Galil, {
  'port': {
    get: function () {
      return ServiceConfiguration.configurations.findOne({ service: 'galil' }).port;
    },
    set: function (port) {
      check(port, Number);
      ServiceConfiguration.configurations.update({ service: 'galil' }, {
        $set: { port: port }
      });
      this._port = port;
    }
  },
  'host': {
    get: function () {
      return ServiceConfiguration.configurations.findOne({ service: 'galil' }).host;
    },
    set: function (host) {
      check(host, String);
      ServiceConfiguration.configurations.update({ service: 'galil' }, {
        $set: { host: host }
      });
      this._host = host;
    }
  }
});

/**
 * Set up a socket connection
 *
 * @module Galil
 * @method _createConnection
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {Function} onError Because this opens a `net.connect`, onError is passed as the Meteor.bindEnvironment callback
 * @private
 */
Galil._createConnection = function(name, onError = _.noop) {
  let self = this;
  check(name, String);

  let log = function(message) {
    return GalilMessages.insert({
      socket: name,
      message: message,
      timestamp: new Date
    });
  }

  let socket = new net.Socket();

  socket.on('data', Meteor.bindEnvironment(function(data) {
    let str = _.trim(data.toString('ascii'));
    if (str === '?') {
      throw new Meteor.Error('GalilError', 'Command not recognized');
    } else if (str === ':') {
      return;
    } else {
      let args = _.compact(str.replace('\r\n', '').split(':'));
      if (args[0] === 'Error')
        throw new Meteor.Error('GalilError', str);

      args.push(name);
      self.emit.apply(self, args);
      log(str);
    }
  }), onError);

  socket.on('error', Meteor.bindEnvironment(log), onError);
  socket.on('close', Meteor.bindEnvironment(log), onError);

  if (this._port && this._host) {
    socket.connect(this._port, this._host, Meteor.bindEnvironment(function() {
      socket.write(`MG "connect"\r`);
    }));
  }

  return socket;
}

Galil._messages = Galil._createConnection('messages');
Galil._commands = Galil._createConnection('commands');

Galil._messages.write('CF I\r');

/**
 * Execute a command on the galil controller
 * TO DO: Wait on the response as "END:[routine]" to return
 *
 * @module Server/Galil
 * @method execute
 * @param {String} command the command to execute
 * @example
 * > Galil.execute('Load');
 */
Galil.execute = function(command) {
  check(command, String);
  commands.write(`XQ #${command}\r`);
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
 * > GalilMessages.find().fetch()
 * [{
 *  socket: 'commands',
 *  message: 'Hello, world!',
 *  timestamp: sometime
 * }]
 *
 * // send a series of commands in sequence
 * > Galil.sendCommand(['MG "Hello, "', 'MG "World!"']);
 * > GalilMessages.find().fetch()
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
  check(command, Match.OneOf(String, Array));
  return new Promise((resolve, reject) => {
    this._commands.write(`${command}\r`, resolve);
  });
};

/**
 * Alias for `Galil.sendCommand`
 *
 * @module Server/Galil
 * @method sendCommand
 * @param {String} command the command to execute
 * @returns {Promise} a promisified response
 * @example
 * > Galil.execute('Load');
 */
Galil.sendCommands = function(commands) {
  check(commands, Array);
  Promise.each(commands, (command) => {
    return this.sendCommand(command);
  });
}

Galil.uploadProgram = function(programFile) {
  let programPath = path.resolve(`../../../../../../programs/${programFile}.cmd`);
  fs.readFileAsync(programPath, 'utf8')
    .then((program) => {
      program += '<cntrl>Z';
      this._commands.write(`UL ${program}\r`);
    }).catch(console.log);
}

Meteor.methods({
  'Galil.sendCommand': Galil.sendCommand.bind(Galil),
  'Galil.sendCommands': Galil.sendCommands.bind(Galil)
});

