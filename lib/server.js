const Socket = Npm.require('net').Socket;
const Future = Npm.require('fibers/future');
const XRegExp = Npm.require('xregexp');
/**
 * Server functions for galil controller.
 * @class GalilServer
 * @extends Galil
 */
GalilServer = class GalilServer extends Galil {
  constructor() {
    super(...arguments);
    this._sockets = new Map();
    this._sockets.set('commands', new GalilSocket('commands'));
    this._sockets.set('messages', new GalilSocket('messages'));
  }
  connect() {
    this._sockets.get('messages').once('connect', () => this._sockets.get('messages').write('CF I\r'));
    this._sockets.forEach(socket => socket.connect(...arguments));
  }
  _debug() {
    if (process.env.NODE_ENV === 'development') {
      console.log(...arguments);
    }
  }
  /**
   * When a message is received, respond to it.
   * This is non-blocking. Use it to listen asynchronously without blocking meteor methods.
   * @function GalilServer#awaitMessageAsync
   * @param {String} socket the name of the socket to listen on. (probably `commands` or `messages`).
   * @param {XRegExp|RegExp} message the message to listen for.
   * @param {Object} options additional options to add
   * @param {Number} [options.timeout=50000] the timeout to wait before throwing an error.
   * @returns {Promise}
   * @throws GalilError if a timeout was exceeded
   */
  awaitMessageAsync(socket, successRegex, errorRegex=/(?!.*?)/, options={timeout:50000}) {
    check(socket, String);
    check(successRegex, Match.OneOf(RegExp, XRegExp, String));
    check(errorRegex, Match.OneOf(RegExp, XRegExp, String));
    check(options, Match.ObjectIncluding({ timeout: Number }));

    let listen;
    let timeoutId;
    let resolver = new XRegExp(successRegex);
    let rejector = new XRegExp(errorRegex);

    return new Promise((resolve, reject) => {
      timeoutId = Meteor.setTimeout(function () {
        reject(new Meteor.Error('GalilTimeout', `Did not receive any messages for ${options.timeout} milliseconds`));
      }, options.timeout);

      listen = Meteor.bindEnvironment((data) => {
        const str = data.toString('ascii');
        console.log(str);
        if (resolver.test(str)) {
          resolve(resolver.exec(str));
        } else if (rejector.test(str)) {
          reject(new Meteor.Error('GalilError', `Encountered error case: ${str}`));
        }
      });

      this._sockets.get(socket).on('data', listen);
    }).finally(() => {
      this._sockets.get(socket).removeListener('data', listen);
      Meteor.clearTimeout(timeoutId);
    });
  }
  /**
   * The "blocking" version of GalilServer#awaitMessageAsync
   * returns synchronously when the message is encountered
   * @function GalilServer#awaitMessageSync
   */
  awaitMessageSync() {
    return Promise.await(Promise.async(this.awaitMessageAsync).apply(this, Array.prototype.slice.call(arguments)));
  }
  sendCommand(command) {
    this._sockets.get('commands').write(`${command}\r`);
    return this.awaitMessageSync('commands', /^.*(\r\n)?\:$/, /^.*(\r\n)?\?$/);
  }
  execute(subroutine, end) {
    this.sendCommand(`XQ#${subroutine}`);
    return this.awaitMessageSync('messages', end);
  }
}
