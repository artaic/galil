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

if (!config) {
  throw new Meteor.Error(500, 'Required configuration for startup');
}

Galil = new EventEmitter();
Galil._port = config.port;
Galil._host = config.host;

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

console.log(Galil);

/**
 * Set up a socket connection
 *
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {Function} onError Because this opens a `net.connect`, onError is passed as the Meteor.bindEnvironment callback
 */
Galil._createConnection = function(name, onError = _.noop) {
  let self = this;

  let log = function(message) {
    return GalilMessages.insert({
      socket: name,
      message: message,
      timestamp: new Date
    });
  }

  let socket = net.connect(this._port, this._host, Meteor.bindEnvironment(function() {
    socket.write(`MG "connect"\r`);
  }));

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

  socket.on('error', Meteor.bindEnvironment(function(error) {
    console.warn(error);
    log(error);
  }), onError);

  return socket;
}

Galil._commands = Galil._createConnection('commands');
Galil._messages = Galil._createConnection('messages');

Galil._messages.write('CF I\r');

/**
 * Execute a command on the galil controller
 * TO DO: Wait on the response as "END:[routine]" to return
 *
 * @module Galil
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
 * @module Galil
 * @method sendCommand
 * @param {String} command the command to execute
 * @returns {Promise} a promisified response
 * @example
 * > Galil.execute('Load');
 */
Galil.sendCommand = function(command) {
  check(command, String);
  return new Promise((resolve, reject) => {
    this._commands.write(`${command}\r`, resolve);
  });
};

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

Galil.on('PillsDispensed', Meteor.bindEnvironment(function (cartridge) {
  let c = Cartridges.findOne({ slot: cartridge });
  console.log(c);
}));

console.log(Galil);

Meteor.methods({
  'Galil.sendCommand': Galil.sendCommand.bind(Galil),
  'Galil.sendCommands': Galil.sendCommands.bind(Galil)
});

