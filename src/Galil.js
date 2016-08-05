import Socket from 'Socket';
import noop from 'lodash/noop';
import Bluebird from 'bluebird';
import { createSocket } from 'dgram';
import { EventEmitter } from 'events';

/**
 * Galil controller.
 *
 * @class Galil
 * @extends events.EventEmitter
 *
 * @emits interrupt when an interrupt is received
 * @emits message when an unsolicited message is received.
 */
export default class Galil extends EventEmitter {
  constructor() {
    super(...arguments);

    this._connected = false;

    this._commands = new Socket();
    this._messages = new Socket();
    this._interrupts = new Socket();

    this._messages
      .on('connect', () => this._messages.send('CF I', 5000))
      .on('data', data => this.emit('message', data));

    Array.from(this.sockets.values()).forEach(socket => {
      socket.on('close', () => this.emit('close', socket));
    });
  }
  get commands() {
    return this._commands;
  }
  get messages() {
    return this._messages;
  }
  get interrupts() {
    return this._interrupts;
  }
  get sockets() {
    return new Map([
      [ "commands",   this._commands     ],
      [ "messages",   this._messages     ],
    ]);
  }
  /**
   * Connect to the galil device.
   * All sockets will be connected, after which, a "connect" event will be fired.
   *
   * @function Galil#connect
   * @param {Number} port the port to connect to
   * @param {String} host the host to connect to
   * @emits connect when successful connection has been established.
   * @emits error when an error in connection occurs.
   * @returns {Promise}
   * @example
   * > galil
   *    .once('connect', () => console.log('All sockets connected.'))
   *    .once('error', err => console.warn(err))
   *    .connect(23, '192.168.1.4')
   *    .then(() => console.log('What now?'))
   *
   * All sockets connected!
   * What now?
   */
  connect() {
    return Bluebird.map(this.sockets.entries(), entry => {
      const [ name, socket ] = entry;
      return socket.connectAsync(...arguments);
    })
    .then(() => this.emit('connect'))
    .catch(err => this.emit('error', err))
  }
  /**
   * Disconnects from the controller
   * Stops all attempts at reconnecting.
   *
   * @function Galil#disconnect
   * @emits disconnect when disconnect is successful
   */
  disconnect() {
    return Bluebird.map(this.sockets.entries(), entry => {
      return new Bluebird((resolve, reject) => {
        const [ name, socket ] = entry;
        socket.stopReconnecting();
        socket.once('close', resolve)
        socket.end();
        socket.destroy();
      });
    }).then(() => this.emit('disconnect'));
  }
  /**
   * Sends a command to the controller.
   * @function Galil#sendCommand
   * @param {String} command the command to send
   * @param {Number} [timeout=5000] the time to wait before throwing an error
   * @return {[String]} array of strings
   */
  async sendCommand(command, timeout=5000) {
    return await this.commands.send(command, timeout);
  }
}
