const net = Npm.require('net');
const Future = Npm.require('fibers/future');

Galil.Connections._ensureIndex({ name: 1 }, { unique: 1 });

/**
 * Tries to execute a subroutine then wait for a message to be given back before unblocking.
 * Reads from an observer on the messages socket, stops the observer when it is finished.
 *
 * @module Galil
 * @function Galil#execute
 *
 * @param {String} subroutine the subroutine to execute
 * @param {RegExp} match the match to watch for.
 * @param {Number} timeout
 *  The amount of time to wait without receiving any messages before throwing a timeout
 *  Measured in milliseconds.
 *  If this value is undefined, no timeout will be set.
 *
 * @throws MatchError if the subroutine is not a string or the match is not a regex
 * @throws GalilTimeout if no data was received in 60 seconds.
 * @throws GalilError if the command was not recognized or the program was not updated
 *
 * @example
 * Galil.execute('Startup', /^End:Startup$/);                                 // do a startup routine
 * Galil.execute('Load Cartridge', /^CartridgeLoaded:(\s+):(\d+)$/, 60000);   // reload cartridges. Expect response every 60 seconds.
 */
Galil.execute = function (subroutine, match, timeout) {
  check(subroutine, String);
  check(match, RegExp);
  check(timeout, Match.Optional(Number));

  const timeoutError = new Meteor.Error('GalilTimeout', `No messages received for ${timeout} seconds`)

  let future = new Future();

  let timeoutId;
  if (timeout) {
    timeoutId = Meteor.setTimeout(() => future.throw(timeoutError), timeout);
  }

  this.Devices.update({ primary: true }, {
    $set: { executing: true }
  });

  let listener = Meteor.bindEnvironment(function (data) {
    Meteor.clearTimeout(timeoutId);
    if (timeout) {
      timeoutId = Meteor.setTimeout(() => future.throw(timeoutError), timeout);
    }
    data.toString('ascii').replace(/\n/, '').split(/\r/).forEach(function (message) {
      if (match.test(message)) {
        future.return(message);
      }
    });
  });

  this._messages.addListener('data', listener);

  this.sendCommand(`XQ#${subroutine}`);

  future.resolve((err, val) => {
    this._messages.removeListener('data', listener);
    Meteor.clearTimeout(timeoutId);
    this.Devices.update({ primary: true }, {
      $set: { executing: false }
    });
  });

  return future.wait();
}

/**
 * Listen for a message to be emitted, then apply a callback.
 * This will return an observer with the method `stop` on it.
 * Call "stop" on this observer when you're done with it.
 *
 * @module Galil
 * @function Galil#listen
 *
 * @param {String} socket the socket to listen on. Can be either `messages` or `commands`.
 * @param {RegExp} expression the regular expression to watch for.
 * @param {Function} callback what to do on the message being found.
 *
 * @returns {Cursor.observe} a cursor observer
 */
Galil.listen = function (socket, expression, callback) {
  check(socket, String);
  check(expression, RegExp);
  check(callback, Function);

  let observer = Galil.Connections.find({
    name: socket
  }).observe({
    changed: function (doc) {
      doc.tail.forEach(function (m) {
        if (expression.test(m.message)) {
          callback(m.message);
        }
      });
    }
  });

  return observer;
}

/**
 * Sends a command on the commands socket
 * Returns the future with the message listener and resolver set up
 *
 * @module Galil
 * @method Galil#_send
 * @private
 *
 * @param {String} command the command to execute
 * @param {Number} timeout define a timeout. Defaults to 60 seconds. (milliseconds)
 *
 * @return {Future} the configured future
 *
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 * @throws GalilTimeout if 60 seconds pass without a success or fail message.
 */
Galil._send = function(command, timeout=60000) {
  check(command, String);
  check(timeout, Number);

  let future = new Future();

  const success = /^\:$/gm;
  const fail    = /^\?$/gm;

  let timeoutId = Meteor.setTimeout(function () {
    future.throw(new Meteor.Error('GalilTimeout', `Execution of ${command} timed out after 60 seconds`));
  }, 60000);

  const listen = Meteor.bindEnvironment(function (data) {
    data.toString('ascii').replace(/\n/, '').split(/\r/).forEach(function (message) {
      if (success.test(message)) {
        future.return(message);
      } else if (fail.test(message)) {
        future.throw(message);
      }
    });
  });

  this._commands.addListener('data', listen);

  future.resolve(() => {
    this._commands.removeListener('data', listen);
    Meteor.clearTimeout(timeoutId);
    Galil.Devices.update({ primary: true }, {
      $set: { executing: false }
    });
  });

  this._commands.write(`${command}\r`, 'utf8');

  return future;
}.future();

/**
 * Sends a command on the commands socket
 * Returns the future with the message listener and resolver set up
 *
 * @module Galil
 * @method Galil#sendCommand
 *
 * @param {String} command the command to execute
 * @return {Future} the future needed
 *
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 * @throws GalilTimeout if 60 seconds pass without a success or fail message.
 *
 * @example
 * > Galil.sendCommand('MG "Hello"');
 * Hello
 */
Galil.sendCommand = function (command, timeout=60000) {
  return this._send(command, timeout)
};

/**
 * Send a series of commands on the command socket. Will execute in order specified.
 * Waits for all futures to resolve.
 * If the last parameter provided is a number, it will be used as the timeout.
 *
 * @module Galil
 * @method Galil#sendCommands
 *
 * @param {String} command the command to execute
 *
 * @throws MatchError if not provided an array or string
 * @throws GalilError if the command was not recognized
 * @throws GalilTimeout if 60 seconds pass without a success or fail message.
 *
 * @example
 * > Galil.sendCommands('MG "Hello"', 'MG "Goodbye"');
 * Hello
 * Goodbye
 * > Galil.sendCommands('MG "Hello"', 'WT 20000', 10000);
 * Hello
 * <GalilTimeout>
 * > Galil.sendCommands.apply(this, ['MG "Hello"', 'MG "Goodbye"']);
 * Hello
 * Goodbye
 */
Galil.sendCommands = function () {
  const commands = Array.prototype.slice.call(arguments);
  let timeout = _.isNumber(commands[commands.length]) ? commands[commands.length] : 60000;

  let futures = commands.map((command) => {
    return this._send(command, timeout);
  });

  return Future.wait(futures);
}

Meteor.publish(null, function() {
  let cursors = Galil.Devices.find({ primary: true }).map(function (device) {
    return Galil.Connections.find({
      _id: { $in: device.connections }
    });
  });

  return cursors.concat(Galil.Devices.find({ primary: true }));
});
