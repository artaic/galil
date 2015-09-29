let net = Npm.require('net');
let Future = Npm.require('fibers/future'), wait = Future.wait;
let EventEmitter = Npm.require('events').EventEmitter;

Galil._encodings = {
  done: String.fromCharCode('26') + String.fromCharCode('58'),  // substitution char and :
  success: String.fromCharCode('10') + String.fromCharCode('58'), // line feed and :
  colon: String.fromCharCode('58'),
  error: '?'
};

Galil.connections._ensureIndex({ name: 1 }, { unique: 1 });

/**
 * Galil controller for server methods
 *
 * @module Galil
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

/**
 * Set up a socket connection with a specified name and adds event listeners
 *
 * @module Galil
 * @method Galil#_createConnection
 *
 * @emits Galil#connect when the socket is connected
 * @emits Galil#close when the socket closes
 *
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 * @param {Function} onError Because this opens a `net.connect`, onError is passed as the Meteor.bindEnvironment callback
 * @throws Meteor.Error when the socket responds with an error
 * @returns {net.Socket} a new configured socket
 * @private
 */

Galil._createConnection = function(name) {
  check(name, String);

  this.connections.upsert({ name: name }, {
    $set: { status: 'disconnected' },
    $setOnInsert: { messages: [], executing: false }
  });

  let socket = net.connect(Meteor.settings.galil.connection, Meteor.bindEnvironment(() => {
    Meteor._debug(`Socket connected. ${name}`);
    this.connections.update({ name: name }, {
      $set: { status: 'connected' }
    });

    socket.addListener('data', Meteor.bindEnvironment((data) => {
      let args = this.parse(data);
      this.connections.update({
        name: socket._name
      }, {
        $push: {
          messages: {
            $each: [{
              message: args.join('\n').replace(this.config.parser._delimiter, ''),
              timestamp: new Date,
              event: args[0]
            }],
            $sort: { timestamp: 1 },
            $slice: this.config.messageLimit * -1
          }
        },
      });
    }));
  }));

  socket._name = name;
  socket.addListener('error', Meteor.bindEnvironment(() => {
    this.connections.update({ name: socket._name }, {
      $set: { status: 'disconnected' }
    });
  }));
  socket.addListener('connect', Meteor.bindEnvironment(() => {
    this.connections.update({ name: socket._name }, {
      $set: { status: 'connected' }
    });
  }));
  socket.addListener('close', Meteor.bindEnvironment((hasError) => {
    this.connections.update({ name: socket._name }, {
      $set: { status: 'disconnected' }
    });
    if (hasError) {
      this.emit('Error', ['Connection error']);
      throw new Meteor.Error('GalilError', 'Connection Error');
    }
  }))
  return socket;
}

Galil._commands = Galil._createConnection('commands');
Galil._messages = Galil._createConnection('messages');

Galil._messages.write('CF I\r');

/**
 * Execute a command on the galil controller
 * This will lock in execution synchronously with a fiber.
 * If no data is received for a specified amount of time, an error will be thrown.
 *
 * @module Galil
 * @method Galil#execute
 * @param {String} command the command to execute
 * @param {Number} seconds the number of seconds to wait before timing out.
 *
 * @returns {String} the name of the routine completed.
 * @throws GalilError.TimeoutError if the timeout is exceeded.
 * @throws GalilError.CommandError if the command leads to an error on the controller
 * @example
 * Galil.execute('Load', 10000);
 */
Galil.execute = function(subroutine, timeout=this.config.defaultTimeout) {
  check(subroutine, String);
  check(timeout, Number);

  let results = '';
  let future = new Future();

  let onData = function (fut, subroutine, data) {
    let onComplete = fut.resolver();
    let success = new RegExp(`End:${subroutine}\r`);
    let error = new RegExp(`Error:\w+\r`);

    results += data.toString('ascii');
    if (success.test(data.toString('ascii'))) {
      fut.return(results.split('\r\n'));
    }
    if (error.test(data.toString('ascii'))) {
      fut.throw(new Meteor.Error(`GalilError`, data.toString('ascii')));
    }
  }.future();

  this._messages.addListener('data', Meteor.bindEnvironment((onData.bind(this, future, subroutine))));

  future.resolve(future, () => {
    this._messages.removeListener('data', Meteor.bindEnvironment(onData.bind(this, future, subroutine)));
  });

  // the first future to resolve is actually sending the command
  // after it is sent successfully, then wait for the other future to run
  this.sendCommand(`XQ#${subroutine}`);

  this.connections.update({}, {
    $set: { executing: true }
  }, { multi: true });

  future.wait();

  this.connections.update({}, {
    $set: { executing: false }
  }, { multi: true });

  return future.value;
};

/**
 * Send a message, wait for an OK to return the future.
 * Note: this doesn't _wait_ for the future. It only returns the future.
 * On the future being resolved, in order to avoid memory leaks, it will unbind the event listener
 *
 * @module Galil
 * @method Galil#_send
 * @private
 * @param {String} command the command to execute
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 */
Galil._send = function(command) {
  check(command, String);

  let future = new Future();

  let onData = function (fut, data) {
    let str = _.trim(data.toString('ascii')).split('\r');
    let status = _.last(str);

    if (status === this._encodings.success || status === this._encodings.colon) {
      fut.return();
    }
    if (status === this._encodings.error || status === String.fromCharCode('63')) {
      fut.throw(new Meteor.Error(`GalilError`, `Command not recognized`));
    }
  }.future();

  future.resolve(future, () => {
    this._commands.removeListener('data', Meteor.bindEnvironment(onData.bind(this, future)));
  });

  this._commands.addListener('data', Meteor.bindEnvironment(onData.bind(this, future)));

  this._commands.write(`${command}\r`, 'utf8');

  return future;
};

/**
 * Sends command to the Galil controller from the server
 *
 * @module Galil
 * @method Galil#sendCommand
 * @param {String} command the command to execute
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 * @example
 * Galil.sendCommand('MG"Hello"');
 * Hello
 */
Galil.sendCommand = function (command) {
  let future = this._send(command);
  future.wait();
  return future.value;
}.future();

/**
 * Sends commands to the controller
 * Takes either a command or an array of commands
 *
 * @module Galil
 * @method Galil#sendCommands
 * @param {*String} commands pass in as many commands as you'll like and they'll execute in sequence.
 * @example
 * > Galil.sendCommands('MG "Hello"', 'MG "Goodbye"');
 * Hello
 * Goodbye
 */
Galil.sendCommands = function(/** commands */) {
  let commands = _.toArray(arguments);
  console.log(commands)

  let futures = _.map(commands, (command) => {
    check(command, String);
    return this._send(command);
  });

  return Future.wait(futures);
}.future();

