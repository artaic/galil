import { Socket } from 'net';
import noop from 'lodash/noop';
import flatten from 'lodash/flatten';
import { call, ExponentialStrategy } from 'backoff';

/**
 * A specialized socket with reconnection properties.
 *
 * @class GalilSocket
 * @extends net.Socket
 */
export default class GalilSocket extends Socket {
  static SUCCESS = /^\:$/;
  static FAILURE = /^\?$/;
  static DELIMITER = /\r\n\;/;
  constructor() {
    super(...arguments);

    this._retries = 0;
    this.setEncoding('ascii');
    this._onReconnect = noop;
    this.on('close', this._onReconnect);
  }
  /**
   * On losing connection to the server,
   * This will attempt to initiate a reconnection with an "exponential" strategy
   * @function GalilSocket#_bindReconnectListener
   * @private
   */
  _bindReconnectListener() {
    this.stopReconnecting();

    this._onReconnect = () => {
      const reconnect = call(() => {
        return this.connect(...arguments);
      }, (err, res) => {
        this.emit('reconnect_attempt', reconnect.getNumRetries());
        if (err) {
          this.emit('error', err);
        } else {
          console.log(res.statusCode);
        }
      });

      const strategy = new ExponentialStrategy();
      reconnect.setStrategy(strategy);
      reconnect.failAfter(10);
      reconnect.start();
    }

    this.on('close', this._onReconnect);
  }
  /**
   * Will stop attempting reconnects.
   * Re-call "connect" in order to rebind this listener.
   *
   * @function stopReconnecting
   * @returns void
   */
  stopReconnecting() {
    this.removeListener('close', this._onReconnect);
  }
  /**
   * Send a command and handle the possiblity of an error response.
   * @function GalilSocket#_send
   * @private
   * @param {String} command the command to send
   * @param {Number} timeout the time before erroring out.
   * @throws GalilError if an error was encountered.
   */
  async _send(command, timeout) {
    let onData = noop;
    const received = [];

    try {
      await new Promise((resolve, reject) => {
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
      }).timeout(timeout);
    } catch (e) {
      console.log(e);
      if (e.message === 'GalilError') {
        const msg = await this._getErrorMessage();
        console.log(msg);
        throw new Error(msg);
      } else {
        throw e;
      }
    } finally {
      this.removeListener('data', onData);
    }
  }
  _splitCommands(commands) {
    return commands.split(GalilSocket.DELIMITER).filter(Boolean);
  }
  async _getErrorMessage() {
    return await this._send('TC 1');
  }
  /**
   * Promisified connect, virtually the same as `net.connect`
   * @function GalilSocket#connectAsync
   * @emits reconnect_attempt when a reconnect is attempted.
   * @returns {Promise} the promise result.
   */
  connectAsync() {
    return new Promise((resolve, reject) => {
      this._bindReconnectListener(...arguments);
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
    return Promise.map(this._splitCommands(commands), command => {
      return this._send(command, timeout);
    });
  }
}
