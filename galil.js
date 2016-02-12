const EventEmitter = Npm.require('events').EventEmitter;
const XRegExp = Npm.require('xregexp');
const Future = Npm.require('fibers/future');
const colors = Npm.require('colors');

/**
 * @TODO: probably export this as a class instead.
 * @module Galil
 */
Galil = {
  _logger: new Mongo.Collection('galil_history'),
  _commands: new GalilSocket('commands'),
  _messages: new GalilSocket('messages'),
  _responses: {
    error: /^(?:\?)\s?$/m,
    success: /^(?:\:)\s?$/m
  },
  _delimiter: /^(?:\n\r)+/g,
  // only log this stuff on development
  _debug() {
    if (process.env.NODE_ENV === 'development') {
    }
  },
  set(variable, value) {
    return this.sendCommand(`${variable}=${value}`);
  },
  get(variable) {
    return this.sendCommand(`${variable}=`);
  },
  connect() {
    this._messages.once('connect', Meteor.bindEnvironment((this._messages.write.bind(this._messages, 'CF I\r'))));
    this._commands.connect(...arguments);
    this._messages.connect(...arguments);
  },
  disconnect() {
    this._commands.disconnect(...arguments);
    this._messages.disconnect(...arguments);
  },
  reconnect() {
    this._commands.reconnect(...arguments);
    this._messages.reconnect(...arguments);
  },
  timeoutIn(future, milliseconds) {
    check(milliseconds, Number);

    let timeoutId = Meteor.setTimeout(() => {
      future.throw(new Meteor.Error(408, "Timeout Exceeded"));
    }, milliseconds);

    future.resolve(() => Meteor.clearTimeout(timeoutId));
  },
  /**
   * Sends a command on the command socket and waits for a positive or negative response from controller.
   *
   * @function execute
   * @module Galil
   * @param {String} command the command to send
   * @param {Number} [timeout=60000] number of milliseconds to wait before timing out
   *
   * @throws 408 if timeout is exceeded
   * @throws 400 if the command or subroutine is not recognized
   */
  sendCommand(command, timeout=60000) {
    check(command, String);

    if (process.env.NODE_ENV === 'development') {
      console.log(colors.green(`\n  [>] ${command}`));
    }

    let future = new Future();
    let timeoutId = Meteor.setTimeout(() => {
      future.throw(new Meteor.Error(408, "Timeout Exceeded"));
    }, timeout);

    let listen = Meteor.bindEnvironment(data => {
      if (this._responses.error.test(data)) {
        future.throw(new Meteor.Error(400, 'Invalid command'));
      } else if (this._responses.success.test(data)) {
        future.return(data);
      }
    });

    this._commands.on('data', listen);
    this._commands.write(`${command}\r`);

    future.resolve(() => {
      this._commands.removeListener('data', listen)
      Meteor.clearTimeout(timeoutId);
    });

    return future.wait();
  },
  /**
   * Waits for a message to be received on the message socket before resolving
   * Resets the timeout on any message being received. Receiving no messages for timeout milliseconds will cause timeout
   *
   * @function execute
   * @module Galil
   * @param {RegExp|XRegExp} regex message to listen for
   * @param {Number} [timeout=60000] the number of milliseconds to wait before throwing an error
   *
   * @throws 408 if timeout is exceeded
   * @throws 400 if the command or subroutine is not recognized
   */
  awaitMessageSync(regex, timeout=60000) {
    check(regex, Match.OneOf(XRegExp, RegExp));

    const future = new Future();

    let timeoutId = Meteor.setTimeout(() => {
      future.throw(future, new Meteor.Error(408, "Timeout exceeded"));
    }, timeout);

    const listener = Meteor.bindEnvironment(data => {
      data.split(/(?:\r\n)+/).filter(Boolean).forEach(token => {
        if (regex.test(token)) {
          future.return(regex.exec(token));
        }
      });

      Meteor.clearTimeout(timeoutId);
      timeoutId = Meteor.setTimeout(() => {
        future.throw.bind(future, new Meteor.Error(408, "Timeout exceeded"))
      }, timeout);
    });
    this._messages.on('data', listener);

    future.resolve((err, res) => {
      this._messages.removeListener('data', listener)
      Meteor.clearTimeout(timeoutId);
      if (process.env.NODE_ENV === 'development') {
        console.log(err ? colors.red(`  [Completed with error]`) : colors.green(`  [Complete]`));
      }
    });

    return future.wait();
  },
  /**
   * Execute a subroutine assigned to the controller.
   *
   * @function execute
   * @module Galil
   * @param {String} subroutine the subroutine, formatted as simply its name. Do not include #
   * @param {RegExp|XRegExp} regex the "end token" to match from the robot
   * @param {Number} [timeout=60000] the number of milliseconds to wait before throwing an error
   *
   * @throws 408 if timeout is exceeded
   * @throws 400 if the command or subroutine is not recognized
   */
  execute(subroutine, regex, timeout=60000) {
    check(subroutine, String);
    check(regex, Match.OneOf(RegExp, XRegExp));
    check(timeout, Number);

    this.sendCommand(`XQ#${subroutine}`, timeout);
    this.awaitMessageSync(regex, timeout);
  },
}
