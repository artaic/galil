let net = Npm.require('net');
let Future = Npm.require('fibers/future');

Galil.connections._ensureIndex({ name: 1 }, { unique: 1 });

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

/**
 * Set up a socket connection with a specified name and adds event listeners
 *
 * @module Server/Galil
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
  Galil.connections.upsert({
    name: name
  }, {
    $set: { status: 'disconnected' },
    $setOnInsert: { messages: [] }
  });

  let socket = net.connect(this.config.connection, Meteor.bindEnvironment(function() {
    Galil.connections.update({
      name: name
    }, {
      $set: { status: 'connected' }
    });
  }));

  socket._name = name;
  socket.setEncoding('ascii');

  let setConnectionClosed = function() {
    return Galil.connections.update({
      name: socket._name
    }, {
      $set: { status: 'disconnected' }
    });
  }

  socket.addListener('connect', Meteor.bindEnvironment(() => {
    this.connections.update({
      name: socket._name
    }, {
      $set: { status: 'connected' }
    });
  }));

  socket.addListener('timeout', Meteor.bindEnvironment(setConnectionClosed));
  socket.addListener('close', Meteor.bindEnvironment(setConnectionClosed));
  socket.addListener('error', Meteor.bindEnvironment((error) => {
    setConnectionClosed();
    throw new Meteor.Error(error);
  }));

  socket.addListener('data', Meteor.bindEnvironment((data) => {
    let args = this.parse(data);

    if (args[0] === 'Error') {
      this.emit('Error', ['command not recognized']);
    }

    this.connections.update({
      name: socket._name
    }, {
      $push: {
        messages: {
          $each: [{
            message: args.join(' ').replace(this.config.parser._delimiter, ''),
            timestamp: new Date,
            event: args[0]
          }],
          $sort: { timestamp: 1 },
          $slice: this.config.messageLimit * -1 || -200
        }
      },
    });
  }));

  return socket;
}

Galil._commands = Galil._createConnection('commands');
Galil._messages = Galil._createConnection('messages');
Galil._messages.write('CF I\r');
Galil._messages.addListener('data', Meteor.bindEnvironment((data) => {
  let args = Galil.parse(data);
  _.each(args, (arg) => {
    Galil.emit.apply(Galil, arg.split(Galil.config.parser._delimiter));
  });
}));

/**
 * Waits for an event to be received or a timeout to return
 * In a "synchronous" style.
 *
 * @param {String} eventName the event bound to the galil controller.
 * @param {Function} fn the function to run and wait on
 * @param {Function} [_.noop] callback what do do after completed.
 */
Galil._waitForEvent = function(eventName, fn, callback) {
  let future = new Future();
  Galil.on(eventName, function() {});
  Galil.on('Error', () => {});
}


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
Galil.execute = function(subroutine, milliseconds) {
  check(subroutine, String);
  check(milliseconds, Match.Optional(Number));

  let future = new Future();
  let timeout = milliseconds || this.config.defaultTimeout;

  let timeoutId = Meteor.setTimeout(() => {
    return future.return(new Meteor.Error('GalilTimeout', `Execution of ${subroutine} failed after ${timeout} milliseconds`));
  }, timeout);

  let onSuccess = function () {
    Meteor.clearTimeout(timeoutId);
    return future.return({
      status: 'success',
      name: subroutine
    });
  }
  let onError = function (args) {
    Meteor.clearTimeout(timeoutId);
    return future.return(new Meteor.Error('GalilError', args.join(':')));
  }

  this.addListener('End', Meteor.bindEnvironment(onSuccess));
  this.addListener('Error', Meteor.bindEnvironment(onError));
  this._commands.write(`XQ#${subroutine}\r`, 'utf8');

  return future.wait();
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
  check(command, Match.OneOf(String, Array));
  this.sendCommands(command);
};

/**
 * Send multiple commands in a single call.
 *
 * @module Server/Galil
 * @method Galil#sendCommands
 * @param {Array} commands pass in as many commands as you'll like and they'll execute in sequence.
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
Galil.sendCommands = function(commands) {
  check(commands, Match.OneOf(Array, String));

  if (_.isString(commands)) {
    commands = [commands];
  }

  let futures = _.map(commands, (command) => {
    let future = new Future();
    let onComplete = future.resolver();
    this._commands.write(`${command}\r`, 'utf8', onComplete);
    return future;
  });
  Future.wait(futures);
}

