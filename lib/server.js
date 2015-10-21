const net = Npm.require('net');
const Future = Npm.require('fibers/future');
const XRegExp = Npm.require('xregexp');

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
 * @param {Number} timeout [Galil.config.defaultTimeout]
 *  The amount of time to wait without receiving any messages before throwing a timeout
 *  Measured in milliseconds.
 *
 * @throws MatchError if the subroutine is not a string or the match is not a regex
 * @throws GalilTimeout if no data was received in 60 seconds.
 * @throws GalilError if the command was not recognized or the program was not updated
 *
 * @example
 * Galil.execute('Startup', /^End:Startup$/);                                 // do a startup routine
 * Galil.execute('Load Cartridge', /^CartridgeLoaded:(\s+):(\d+)$/, 60000);   // reload cartridges. Expect response every 60 seconds.
 */
Galil.execute = function (subroutine, match, timeout=this.config.defaultTimeout) {
  check(subroutine, String);
  check(match, RegExp);

  timeout = timeout || Galil.Devices.findOne({ primary: true }).config.defaultTimeout;
  const timeoutError = new Meteor.Error('GalilTimeout', `No messages received for ${timeout} seconds`)

  let future = new Future();
  this.sendCommand(`XQ#${subroutine}`);

  let timeoutId = Meteor.setTimeout(() => future.throw(n), timeout);

  this.Devices.update({ primary: true }, {
    $set: { executing: true }
  });

  let observer = this.Connections.find({
    'name': 'messages',
  }).observe({
    changed: (doc) => {
      // reset the timer
      Meteor.clearTimeout(timeoutId);
      timeoutId = Meteor.setTimeout(() => future.throw(n), timeout);
      const result = _.find(doc.tail, m => match.test(m.message));
      if (result) {
        future.return(result);
      }
    }
  });

  future.resolve((err, val) => {
    observer.stop();
    Meteor.clearTimeout(timeoutId);
    this.Devices.update({ primary: true }, {
      $set: { executing: false }
    });
  });

  return future.wait();
}

/**
 * Listens for a given message (requires regex)
 * You can use advanced regexes as specified in XRegExp library on NPM.
 * Upon receiving the given message, will execute the given callback asynchronously.
 *
 * Returns the observer handle so that you can use it.
 * -- Make sure to call `stop()` on the observer in order to prevent memory leaks. --
 * See the example below to see how this would be managed.
 *
 * @module Galil
 * @function Galil#listen
 *
 * @param {String} socketName the socket to listen on. `messages` or `commands`
 * @param {RegExp} message the message to listen for
 * @param {Function} onDataReceived when a message matches the regex, it will execute this function.
 *
 * @example
 * // say you're using a future function.
 * let future = new Future();
 * let observer = Galil.listen('messages', /^(Success)$/gm, function (message) {
 *   future.return(message[1]);
 * });
 * // stop the observer now that you're done with it on the future resolving.
 * future.resolve(() => observer.stop());
 */
Galil.listen = function(socketName, messages, callback) {
  check(message, RegExp);
  check(socketName, String);
  check(callback, Function);

  return Galil.Connections.find({
    name: socketName,
    'tail.message': {
      $regex: message
    }
  }).observe({
    changed: function (doc) {
      callback(doc.tail.message);
    }
  });
}

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
 */
Galil.sendCommand = function(command) {
  check(command, String);

  let future = new Future();

  const success = /^\:$/gm;
  const fail =    /^\?$/gm;

  let timeoutId = Meteor.setTimeout(function () {
    future.throw(new Meteor.Error('GalilTimeout', `Execution of ${command} timed out after 60 seconds`));
  }, 60000);

  let observer = this.Connections.find({
    name: 'commands',
    'tail.message': {
      $in: [success, fail]
    }
  }, {
    fields: { 'tail.$.message': 1 }
  }).observe({
    changed: (doc) => {
      doc.tail.forEach(function (m) {
        if (success.test(m.message)) {
          future.return(m.message);
        } else if (fail.test(m.message)) {
          future.throw(new Meteor.Error('GalilError', 'Command not recognized'));
        }
      });
    }
  });

  future.resolve(() => {
    observer.stop();
    Meteor.clearTimeout(timeoutId);
    Galil.Devices.update({ primary: true }, {
      $set: { executing: false }
    });
  });

  this._commands.write(`${command}\r`, 'utf8');

  return future.wait();
};

/**
 * The same as `Galil.sendCommand`, but with multiple commands.
 *
 * @module Galil
 * @function Galil#sendCommands
 * @param {String*} commands the commands to send
 *
 * @example
 * > Galil.sendCommands('MG "Hello"', 'MG "Goodbye"');
 * Hello
 * Goodbye
 */
Galil.sendCommands = function (/** commands */) {
  const commands = Array.prototype.slice.call(arguments);

  let futures = commands.map(() => {
    let future = new Future();

    const success = /^\:$/gm;
    const fail =    /^\?$/gm;

    let timeoutId = Meteor.setTimeout(function () {
      future.throw(new Meteor.Error('GalilTimeout', `Execution of ${command} timed out after 60 seconds`));
    }, 60000);

    let observer = this.Connections.find({
      name: 'commands',
      'tail.message': {
        $in: [success, fail]
      }
    }, {
      fields: { 'tail.$.message': 1 }
    }).observe({
      changed: (doc) => {
        doc.tail.forEach(function (m) {
          if (success.test(m.message)) {
            future.return(m.message);
          } else if (fail.test(m.message)) {
            future.throw(new Meteor.Error('GalilError', 'Command not recognized'));
          }
        });
      }
    });

    future.resolve(() => {
      observer.stop();
      Meteor.clearTimeout(timeoutId);
      Galil.Devices.update({ primary: true }, {
        $set: { executing: false }
      });
    });

    this._commands.write(`${command}\r`, 'utf8');

    return future;
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
