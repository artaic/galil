const net = Npm.require('net');
const XRegExp = Npm.require('xregexp');
const Future = Npm.require('fibers/future');

Galil._encodings = {
  done: String.fromCharCode('26') + String.fromCharCode('58'), // substitution char and :
  success: String.fromCharCode('10') + String.fromCharCode('58'), // line feed and :
  colon: String.fromCharCode('58'),
  error: '?'
};

Galil.connections._ensureIndex({
  name: 1
}, {
  unique: 1
});

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
 * @throws GalilTimeout if timeout is exceeded.
 * @returns {Future} the future in question.
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
function MessageListener(socket, listenFunction, timeout = Galil.config.defaultTimeout) {
  check(socket, net.Socket);
  check(listenFunction, Function);

  let future = new Future();
  let callback = Meteor.bindEnvironment(listenFunction.bind(this, future.resolver()));

  future.resolve(function() {
    socket.removeListener('data', callback);
  });

  socket.addListener('data', callback);

  return future;
};

/**
 * Tries to execute a subroutine then wait for a message to be given back before unblocking.
 * Reads from an observer on the messages socket, stops the observer when it is finished.
 *
 * @module Galil
 * @function Galil#execute
 *
 * @param {String} subroutine the subroutine to execute
 * @param {RegExp|String} match the match to watch for.
 *
 * @example
 * function multipleExecutions = function () {
 *   Galil.watch(/^CartridgeLoaded:$(\s+):(\d+)$/, function (loaded) {
 *     Cartridges.update(loaded[1], {
 *       $inc: { count: loaded[2] }
 *     });
 *   });
 *   Galil.execute('Startup', /^End:Startup$/);
 *   Galil.execute('Load Cartridge', /^CartridgeLoaded:(\s+):(\d+)$/);
 * }
 */
Galil.execute = function(subroutine, match) {
  check(subroutine, String);
  check(match, Match.OneOf(RegExp, String));

  let observer;
  let timerId;
  let promise = Promise.denodeify(Galil.connections.update).call(Galil.connections, {}, {
    $set: { executing: true }
  }, { multi: true }).then(() => new Promise((resolve, reject) => {
    if (_.any(this.connections.find().map((doc) => doc.connection.status !== 'connected'))) {
      reject(new Meteor.Error('GalilConnection', "Connection closed"));
    }

    const startTime = new Date();
    observer = this.connections.find({
      name: 'messages'
    }).observe({
      changed: function(doc) {
        if (_.any(doc._lastMessage, (m) => match.test(m.message))) {
          resolve(doc._lastMessage.map(function(message) {
            return _.extend(message, {
              timeDelta: Math.abs(startTime - message.timestamp)
            })
          }));
        }
      }
    });

    this._commands.write(`XQ#${subroutine}\r`, 'utf8');
  })).finally(() => {
    observer.stop()
    return Promise.denodeify(Galil.connections.update).call(Galil.connections, {}, {
      $set: { executing: false }
    }, { multi: true });
  });

  return Promise.await(promise);
}

/**
 * Watches for a message. Allows for the asynchronous callbacks to be executed.
 * The callback is bound with a `stop` handle to stop the observer.
 * Uses XRegExp to parse the data with advanced regular expression.
 *
 * @module Galil
 * @function Galil#watch
 *
 * @param {RegExp|String} match the message to match. This will also be bound to callback.
 * @param {Function} callback the simple
 *
 * @example
 * Galil.watch(/^Loaded:(\d+)\r$/, function (groups, observer) {
 *   Meteor.users.update({ _id: groups. });
 * });
 */
Galil.watch = function(match, callback) {
  const regex = XRegExp(match);
  const result = regex.exec(match);
}

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

Galil.listen = function(message, callback) {
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
Galil.sendCommand = function(command) {
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
Galil.sendCommands = function( /** commands */ ) {
  let commands = _.toArray(arguments);

  let futures = _.map(commands, (command) => {
    check(command, String);
    return this._send(command);
  });

  return Future.wait(futures);
};

Meteor.publish(null, function() {
  return Galil.connections.find();
});
