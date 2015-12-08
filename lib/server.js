const Socket = Npm.require('net').Socket;
const Future = Npm.require('fibers/future');
const XRegExp = Npm.require('xregexp');
/**
 * Server functions for galil controller.
 * @class GalilServer
 * @extends Galil
 */
Galil = class GalilServer extends GalilBase {
  constructor() {
    super(...arguments);
    this._sockets = new Map();
    this._sockets.set('commands', new GalilSocket(this._id, 'commands'));
    this._sockets.set('messages', new GalilSocket(this._id, 'messages'));
    this.connect(this.connection);
  }
  _debug() {
    let util = require('util');
    if (process.env.NODE_ENV === 'development') {
      [...arguments].forEach(function (str) {
        console.log(str.split('').map(char => util.inspect(char)));
      });
    }
  }
  _resetTimer(timerId, timeout, resolver, rejector) {
    Meteor.clearTimeout(timerId);
    return Meteor.setTimeout(function () {
      rejector(new Meteor.Error('GalilTimeout', `Did not receive any messages for ${timeout} milliseconds`));
    }, timeout);
  }
  get sockets() {
    return this._sockets;
  }
  connect() {
    this._sockets.get('messages').once('connect', () => this._sockets.get('messages').write('CF I\r'));
    this._sockets.forEach(socket => socket.connect(...arguments));
  }
  /**
   * When a message is received, respond to it.
   * This is non-blocking. Use it to listen asynchronously without blocking meteor methods.
   * Using promises also seems more backwards compatible.
   *
   * @function GalilServer#awaitOnceAsync
   * @param {String} socket the name of the socket to listen on. (probably `commands` or `messages`).
   * @param {XRegExp|RegExp|String} message the message to listen for.
   * @param {Object} options additional options to add
   * @param {Number} [options.timeout=50000] the timeout to wait before throwing an error.
   * @returns {Promise}
   * @throws GalilError if a timeout was exceeded
   */
  awaitOnceAsync(socket, successRegex, errorRegex=/(?!.*?)/, options={timeout:50000}) {
    check(socket, String);
    check(successRegex, Match.OneOf(RegExp, XRegExp, String));
    check(errorRegex, Match.OneOf(RegExp, XRegExp, String));
    check(options, Match.ObjectIncluding({ timeout: Number }));

    let listen;
    let timeoutId;
    let resolver = new XRegExp(successRegex);
    let rejector = new XRegExp(errorRegex);

    return new Promise((resolve, reject) => {
      timeoutId = this._resetTimer(timeoutId, options.timeout, resolve, reject);
      listen = Meteor.bindEnvironment((data) => {
        timeoutId = this._resetTimer(timeoutId, options.timeout, resolve, reject);
        const str = data.toString('ascii');
        if (resolver.test(str)) {
          resolve(resolver.exec(str));
        } else if (rejector.test(str)) {
          reject(new Meteor.Error('GalilError', `Encountered error case: ${str}`));
        }
      });
      this._sockets.get(socket).end();  // close the socket so they can't continue to write to it until receiving a message.
      this._sockets.get(socket).on('data', listen);
    }).finally(() => {
      this._sockets.get(socket).removeListener('data', listen);
      this._sockets.get(socket).connect();
      Meteor.clearTimeout(timeoutId);
    });
  }
  /**
   * The "blocking" version of GalilServer#awaitMessageAsync
   * returns synchronously when the message is encountered
   * @function GalilServer#awaitOnce
   */
  awaitOnce() {
    const args = Array.prototype.slice.call(arguments);
    return Promise.await(Promise.async(this.awaitOnceAsync).apply(this, args));
  }
  /**
   * @function GalilServer#sendCommand
   */
  sendCommand(command) {
    check(command, String);
    this._sockets.get('commands').write(`${command}\r`);
    return this.awaitOnce('commands', /^.*(\r\n)?\:$/, /^.*(\r\n)?\?$/);
  }
  /**
   * @function GalilServer#execute
   * @param {String} subroutine the subroutine to execute
   * @param {RegExp|XRegExp|String} end the token to listen for at the end.
   * @param {Object} options the options to pass in.
   * @param {Number} [options.timeout=60000] how long to wait before timing out.
   */
  execute(subroutine, end, options={timeout:60000}) {
    this.sendCommand(`XQ#${subroutine}`);
    return this.awaitOnce('messages', end, options);
  }
}
