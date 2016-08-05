import Bluebird from 'bluebird';
import noop from 'lodash/noop';
import flatten from 'lodash/flatten';
import { EverSocket as Socket } from 'eversocket';

/**
 * A specialized socket with reconnection properties.
 *
 * @class GalilSocket
 * @extends EverSocket
 */
export default class GalilSocket extends Socket {
  static SUCCESS = /^\:$/;
  static FAILURE = /^\?$/;
  static DELIMITER = /\r\n\;/;
  constructor() {
    super({
      reconnectWait: 1000,
      timeout: 5000,
      reconnectOnTimeout: true
    });
    this.setEncoding('ascii');
  }
  /**
   * Send a command and handle the possiblity of an error response.
   * @function GalilSocket#_send
   * @private
   * @param {String} command the command to send
   * @param {Number} timeout the time before erroring out.
   * @throws GalilError if an error was encountered.
   */
  _send(command, timeout) {
    let onData = noop;
    const received = [];

    return new Bluebird((resolveOuter, rejectOuter) => {
      return new Bluebird((resolve, reject) => {
        onData = function (data) {
          data.split(/\r\n/).forEach(line => {
            if (GalilSocket.SUCCESS.test(line)) {
              resolve(flatten(received));
            } else if (GalilSocket.FAILURE.test(line)) {
              reject(new Error('GalilError')); // fix me.
            } else {
              received.push(line);
            }
          });
        }
        this.on('data', onData).write(`${command}\r\n`);
      }).then(resolveOuter).catch(err => {
        return this._getErrorMessage().then(err => {
          rejectOuter(new Error(err));
        }).catch(rejectOuter);
      });
    }).finally(() => {
      this.removeListener('data', onData);
    });
  }
  _splitCommands(commands) {
    return commands.split(GalilSocket.DELIMITER).filter(Boolean);
  }
  async _getErrorMessage() {
    return this._send('TC 1');
  }
  /**
   * Promisified connect, virtually the same as `net.connect`
   * @function GalilSocket#connectAsync
   * @emits reconnect_attempt when a reconnect is attempted.
   * @returns {Promise} the promise result.
   */
  connectAsync() {
    return new Promise((resolve, reject) => {
      this.once('connect', resolve).once('error', reject);
      super.connect(...arguments);
    });
  }
  /**
   * Send a command to this socket and await a response.
   *
   * @function GalilSocket#send
   * @param {String|[String]} commands the commands to send. Will split on delimiter.
   * @param {Number} timeout the timeout for each individual command
   * @returns {Promise}
   * @example
   * const s = new GalilSocket();
   * let onData = function (data) {
   *   console.log(`Received data! ${data}`);
   * }
   * s.connectAsync(5000, '::').then(() => {
   *   s.on('data', onData);
   *   return s.send('MG "Hello!"');
   * }).finally(() => {
   *   s.removeListener('data', onData);
   * });
   */
  send(commands, timeout) {
    const arr = this._splitCommands(commands);
    return Bluebird.map(arr, command => {
      return this._send(command, timeout);
    });
  }
}
