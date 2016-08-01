import { Socket } from 'net';
import noop from 'lodash/noop';
import { call, ExponentialStrategy } from 'backoff';

/**
 * A specialized socket with reconnection properties.
 *
 * @class GalilSocket
 * @extends net.Socket
 */
export default class GalilSocket extends Socket {
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
   *
   * @function GalilSocket#_bindReconnectListener
   * @returns void
   */
  _bindReconnectListener() {
    console.log(Array.from(arguments));
    this.removeListener('close', this._onReconnect);
    this._onReconnect = () => {
      const connectAttempt = call(() => {
        return this.connect(...arguments);
      }, (err, res) => {
        this.emit('reconnect_attempt', connectAttempt.getNumRetries());
        if (err) {
          this.emit('error', err);
        } else {
          console.log(res.statusCode);
        }
      });

      const strategy = new ExponentialStrategy();
      connectAttempt.setStrategy(strategy);
      connectAttempt.failAfter(10);
      connectAttempt.start();
    }
    this.on('close', this._onReconnect);
  }
  /**
   * Promisified connect
   *
   * @function GalilSocket#connectAsync
   * @returns {Promise} the promise result.
   */
  connectAsync() {
    return new Promise((resolve, reject) => {
      this._bindReconnectListener(...arguments);
      this.once('connect', resolve).once('error', reject);
      super.connect(...arguments);
    });
  }
}
