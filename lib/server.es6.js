let net = Npm.require('net');
let EventEmitter = Npm.require('events').EventEmitter;

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

  let socket = net.connect(this.config.connection);
  socket._name = name;
  socket.setEncoding('ascii');

  let setStatus = (status) => Galil.connections.update({ name: socket._name }, { $set: { status: status }});

  socket.addListener('connect', Meteor.bindEnvironment(() => setStatus('connected')));
  socket.addListener('timeout', Meteor.bindEnvironment(() => setStatus('disconnected')));
  socket.addListener('close', Meteor.bindEnvironment(() => setStatus('disconnected')));
  socket.addListener('error', Meteor.bindEnvironment((error) => {
    setStatus('disconnected');
    throw new Meteor.Error(error);
  }));

  socket.addListener('data', Meteor.bindEnvironment((data) => {
    let args = this.parse(data);
    Galil.connections.update({ name: socket._name }, {
      $push: {
        messages: {
          message: args.join(' ').replace(this.config.parser._delimiter, ''),
          timestamp: new Date,
          event: args[0]
        }
      }
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
      resolve();
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
  return args.reduce((p, bit) => {
    return p.then(() => this.sendCommand(bit));
  }, Promise.resolve());
}

