let net = Npm.require('net');
let Future = Npm.require('fibers/future'), wait = Future.wait;

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
 * This will upsert a connection into the Galil.connections table (which, in turn, update the front end reactive vars)
 * Because this is a TCP socket, it cannot be accessed on the front end. Therefore, it will only update the mongo collection.
 * Messages will be pushed to the `messages` field as they are received.
 *
 * @module Galil
 * @method Galil#_createConnection
 * @private
 *
 * @param {String} name The name for the connection. Mostly used for humans to identify it.
 *
 * @throws MongoError if `name` is not unique
 * @throws MatchError if `name` is not a string.
 * @returns {net.Socket} a new configured TCP socket
 */
Galil._createConnection = function(name) {
  check(name, String);

  let socket = new net.Socket();
  socket._name = name;

  this.connections.upsert({ name: socket._name }, {
    $set: { status: 'connecting' },
    $setOnInsert: {
      messages: [],
      executing: false
    }
  });

  socket.connect(Meteor.settings.galil.connection, Meteor.bindEnvironment(() => {
    this.connections.update({ name: socket._name }, {
      $set: { status: 'connected' }
    });
    socket.addListener('data', Meteor.bindEnvironment((data) => {
      let messages = _.compact(data.toString('ascii').replace(/\n/g, '\r').split(/\r+/)).map((s) => ({
        message: s,
        timestamp: new Date()
      }));
      console.log(messages);

      this.connections.update({
        name: socket._name
      }, {
        $push: {
          messages: {
            $each: messages,
            $sort: { timestamp: 1 },
            $slice: this.config.messageLimit * -1
          }
        },
      });
    }));
  }));

  socket.addListener('close', Meteor.bindEnvironment((hasError) => {
    this.connections.update({ name: socket._name }, {
      $set: { status: hasError ? 'failed' : 'offline' }
    });
  }))

  return socket;
}

Galil._commands = Galil._createConnection('commands');
Galil._messages = Galil._createConnection('messages');

// using this command will make messages from subroutines go to `messages`
// this is a little more convenient to handle.
Galil._messages.write('CF I\r');

/**
 * Listens for a message on a socket
 * This will put a callback on `resolve` to unbind the listener
 * It will pass the future resolver into the listen function as the first parameter.
 * You can use this in order to parse the messages and return
 *
 * @method Galil#MessageListener
 * @private
 * @param {net.Socket} socket the socket to listen on
 * @param {Function} listenFunction The function to use for listening. Passes the `future.resolver()` for usage in the function.
 * @returns {Future} the future in question.
 *
 * @TODO create a timeout if no message is received in x amount of time.
 *
 * @example
 * // waitForOkay will be the future.
 * // the `done` passed to the function will be the
 * let waitForOkay = new MessageListener(Galil._commands, function (data, done) {
 *   if (data.toString('ascii') === 'OK') {
 *     done();
 *   }
 * });
 * waitForOkay.wait();
 */
function MessageListener(socket, listenFunction) {
  check(socket, net.Socket);
  check(listenFunction, Function);

  let future = new Future();
  let callback = Meteor.bindEnvironment(listenFunction.bind(this, future.resolver()));

  future.resolve(function () {
    socket.removeListener('data', callback);
  });

  socket.addListener('data', callback);

  return future;
};

Galil.MessageListener = MessageListener;

/**
 * Execute a command on the galil controller
 * This will listen for the token signifying the end of a subroutine.
 * There is an `onData` callback created for parsing any data received during execution
 * This can be used for asynchronous operations as you read data.
 *
 * @module Galil
 * @method Galil#execute
 * @param {String} command the command to execute
 * @param {Function} onData when data is received, it is passed to this callback so you can do async operations.
 *
 * @example
 * Galil.execute('Load', function (message) {
 *   // everything in this callback is passed the data and can respond to it.
 *   // sentMessages being a message formatted like: `Sent:someidhere:32`
 *
 *   let sentMessages = /^Sent:(\w):(\d)\r$/g.match(message);
 *   if (sentMessages && sentMessages[1] && sentMessages[2]) {
 *     Messages.update(sentMessages[2], {
 *       $inc: { sentCount: sentMessages[1] }
 *     })
 *   }
 * });
 */
Galil.execute = function(subroutine, onData=_.noop) {
  check(subroutine, String);
  check(onData, Function);

  let results = '';

  let future = new MessageListener(this._messages, (done, data) => {
    onData(data.toString('ascii'), done);
    let success = new RegExp(`End:${subroutine}\r`);
    let error = new RegExp(`Error:.+\r`);
    results += data.toString('ascii');
    if (success.test(data.toString('ascii'))) {
      done(null, results.split('\r\n'));
    } else if (error.test(data.toString('ascii'))) {
      done(new Meteor.Error(`GalilError`, data.toString('ascii')));
    }
  });

  this.sendCommand(`XQ#${subroutine}`);
  future.wait();
};

Galil.listen = function (message, callback) {
  check(message, RegExp);
  check(callback, Function);

  let future = new MessageListener(this._messages, (done, data) => {
    if (message.test(data.toString('ascii'))) {
      callback(data.toString('ascii'));
      done();
    }
  });
}

/**
 * Sends a command on the commands socket
 * Returns the future with the message listener and resolver set up
 *
 * @module Galil
 * @method Galil#_send
 * @private
 * @param {String} command the command to execute
 * @return {Future} the future needed
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 */
Galil._send = function(command) {
  check(command, String);

  let future = new MessageListener(this._commands, (done, data) => {
    let str = _.trim(data.toString('ascii')).split('\r');
    let status = _.last(str);

    if (status === String.fromCharCode('58') || status === String.fromCharCode('10') + String.fromCharCode('58')) {
      done();
    } else if (status === this._encodings.error || status === String.fromCharCode('63')) {
      done(new Meteor.Error(`GalilError`, `Command not recognized`));
    }
  });

  this._commands.write(`${command}\r`, 'utf8');

  return future;
};

/**
 * Sends command to the Galil controller from the server
 * Waits for an OK from the controller (interpreted as `:\r`)
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
  return this._send(command).wait();
};

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

  let futures = _.map(commands, (command) => {
    check(command, String);
    return this._send(command);
  });

  return Future.wait(futures);
};

