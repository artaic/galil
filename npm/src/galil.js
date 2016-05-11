import Promise from 'bluebird';
import {EventEmitter} from 'events';

import Socket from './socket';

/**
 * @class Galil
 * @extends {EventEmitter}
 */
export class Galil extends EventEmitter {
  /**
   * constructor
   * @param {Object} address the address object to connect to.
   * @param {Number} address.port the port to connect to
   * @param {String} address.host the host to connect to
   */
  constructor(address) {
    super();

    this._address = address;
    this._commands = new Socket('commands', address);
    this._messages = new Socket('messages', address);

    this._messages.on('connect', () => this._messages.send('CF I'));
  }
  /** @type {Object} */
  get address() {
    return this._address;
  }
  /** @type {GalilSocket} */
  get messages() {
    return this._messages;
  }
  /** @type {GalilSocket} */
  get commands() {
    return this._commands;
  }
  /**
   * return all the sockets bound to this instance.
   * @return {GalilSocket[]}
   */
  sockets() {
    return [this._commands, this._messages];
  }
  /**
   * Connect the galil controller
   *
   * @emits {error} if an error occured during connection
   * @emits {connect} when all the sockets have been successfully connected
   * @return {Promise}
   */
  connect() {
    return Promise.all(this.sockets().map(socket => socket.connect()))
      .then(() => {
        if (process.env.NODE_ENV === 'development') {
          this.sockets().forEach(socket => {
            const remote = socket.remoteAddress();
            console.log(`${socket.name} connected at ${remote.address}:${remote.port}`);
          });
        }
        this.emit('connect')
      })
      .catch(err => this.emit('error', err));
  }
  /**
   * Send a series of commands on this socket
   * Resolves or rejects
   *
   * @param {String|String[]} commands the commands to send.
   * @param {Object} options the options for commands
   * @param {Number} options.timeout the amount of time to wait (per command) before timing out
   * @return {Promise}
   */
  sendCommand(commands, options) {
    options = _.defaults(options, { timeout: 5 * 1000 });
    commands = commands instanceof Array ? commands : [commands];

    return Promise.map(commands, command => this._commands.send(command, options.timeout), { concurrency: 1 });
  }
}

export default Galil;

