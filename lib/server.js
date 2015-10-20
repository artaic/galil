const net = Npm.require('net');
const XRegExp = Npm.require('xregexp');
const Future = Npm.require('fibers/future');

Galil._encodings = {
  done: String.fromCharCode('26') + String.fromCharCode('58'), // substitution char and :
  success: String.fromCharCode('10') + String.fromCharCode('58'), // line feed and :
  colon: String.fromCharCode('58'),
  error: '?'
};

Galil.connections._ensureIndex({ name: 1 }, { unique: 1 });

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
Galil.execute = function (subroutine, match) {
  check(subroutine, String);
  check(match, RegExp);

  this.sendCommand(`XQ#${subroutine}`);
  let future = new Future();

  let timeoutId = Meteor.setTimeout(() => {
    future.throw(new Meteor.Error('GalilTimeout', 'No messages received for 60 seconds'));
  }, 60000);

  this.connections.update({}, {
    $set: { executing: true }
  }, { multi: true });

  let observer = this.connections.find({
    'name': 'messages',
    // '_lastMessage.message': { $regex: match }
  }).observe({
    changed: (doc) => {
      const result = _.find(doc._lastMessage, m => match.test(m.message));
      if (result) {
        future.return(result);
      }
    }
  });

  future.resolve((err, val) => {
    observer.stop();
    Meteor.clearTimeout(timeoutId);
    this.connections.update({}, {
      $set: { executing: false }
    }, { multi: true });
  });

  return future.wait();
}

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
 * @method Galil#sendCommand
 * @private
 * @param {String} command the command to execute
 * @return {Future} the future needed
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 */
Galil._send = function(command) {
  check(command, String);

  let future = new Future();

  const success = /^\:$/;
  const fail =    /^\?$/;
  this.connections.find({
    name: 'commands',
    '_lastMessage.message': {
      $in: [success, fail]
    }
  }, {
    fields: { '_lastMessage.$.message': 1 }
  }).observe({
    changed: (doc) => {
      doc._lastMessage.forEach(function (m) {
        if (success.test(m.message)) {
          future.return(m);
        } else if (fail.test(m.message)) {
          future.throw(new Meteor.Error("GalilError", "Command not recognized"));
        }
      });
    }
  });

  this._commands.write(`${command}\r`, 'utf8');

  return future;
}.future();

Galil.sendCommand = function (command) {
  check(command, String);

  let future = new Future();

  let observer = this.connections.find({
    name: 'commands',
    '_lastMessage.message': {
      $in: [/^\:$/, /^\?$/]
    }
  }, {
    fields: { '_lastMessage.$.message': 1 }
  }).observe({
    changed: (doc) => {
      if (/^\:$/.test(doc._lastMessage[0].message)) {
        future.return(doc._lastMessage[0].message);
      } else if (/^\?$/.test(doc._lastMessage[0].message)) {
        future.throw(new Meteor.Error("GalilError", "Invalid command"));
      }
    }
  });

  this._commands.write(`${command}\r`, 'utf8');

  future.resolve(() => observer.stop());

  return future.wait();
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
