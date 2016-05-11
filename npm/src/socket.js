import {Socket} from 'net';
import Promise from 'bluebird';

/** @type {Object} */
export const responses = {
  success: /^\:$/,
  error: /^\?$/,
  delimiter: /[\;\n\r]/
};

/**
 * A basic augmented socket for connecting to a galil
 *
 * @class {GalilSocket}
 * @extends {net.Socket}
 */
export default class GalilSocket extends Socket {
  /**
   * constructor
   * @param {String} name the name for this socket, should be unique.
   * @param {Object} address the address connection
   * @param {Number} address.port the port to connect to
   * @param {String} address.host the host to connect to
   */
  constructor(name, address) {
    super();

    this.setEncoding('ascii');
    this._name = name;
    this._address = address;

    this.on('close', () => {
      setTimeout(() => super.connect(this._address), 5000);
    });
  }
  /**
   * Get the error message in a readable way from the socket
   * @access private
   * @returns {Promise}
   */
  _tellError() {
    return new Promise((resolve, reject) => {
      this.once('data', data => {
        resolve(new Error(data.split(/\r\n/)[0]))
      }).write(`TC 1\r\n`)
    }).timeout(5000);
  }
  /**
   * Connect the socket to the address
   *
   * @override
   * @returns {Promise}
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.once('connect', resolve).once('error', reject);
      super.connect(this._address);
    });
  }
  /**
   * Send one or more command to this socket
   * Expects to receive a : in response from the socket
   * if not, it will time out
   *
   * @param {String} commands the commands to send to this socket. Will split on /\;/
   * @param {Number} timeout how long to wait before timing out with this command.
   * @returns {Promise}
   * @example
   * let socket = new GalilSocket({
   *   host: '192.168.1.4',
   *   port: 23
   * });
   * socket.send([
   *   'MG "You say hello"',
   *   'MG "And I say goodbye"'
   * ]).then(() => console.log('Messages sent'));
   */
  send(commands, timeout=5000) {
    const fixedCommands = commands.split(/\;/).filter(Boolean);

    return Promise.map(fixedCommands, command => {
      let onData = function(){};
      let onError = function (){};

      return new Promise((resolve, reject) => {
        onError = data => {
          data.split(/\r\n/).forEach(line => {
            if (responses.error.test(line)) {
              this.removeListener('data', onData);
              this._tellError().then(err => reject(err));
            }
          });
        };

        onData = data => {
          data.split(/\r\n/).forEach(line => {
            if (responses.success.test(line)) resolve(command);
          });
        };

        this.on('data', onError).on('data', onData).write(`${command}\r\n`);
      }).timeout(timeout).finally(() => {
        this.removeListener('data', onData);
        this.removeListener('data', onError);
      });
    });
  }
}
