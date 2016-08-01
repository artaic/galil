import Socket from 'Socket';
import { EventEmitter } from 'events';

/**
 * Galil controller.
 *
 * @class Galil
 * @extends events.EventEmitter
 */
export default class Galil extends EventEmitter {
  constructor() {
    super(...arguments);
    this._commands = new Socket();
    this._messages = new Socket();
    this._interrupts = new Socket();

    this._messages
      .on('connect', () => this._messages.write('CF I\r\n'))
      .on('data', data => this.emit('message', data));

    this._interrupts
      .on('connect', () => this._interrupts.write('EF'))
      .on('data', data => {
        console.log('Received software interrupt')
      });
  }
  /**
   * Finds all available devices.
   *
   * @function Galil.findDevices
   * @static
   * @returns {[Object]} all devices that were found.
   * @example
   * > Galil.findDevices();
   * [{
   *   port: 5000,
   *   address: '::'
   * }]
   */
  static findDevices() {
    console.log('Searching for devices...')
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
    return {
      commands: this._commands,
      messages: this._messages,
      interrupts: this._interrupts
    };
  }
  /**
   * Connect to the galil device.
   * All sockets will be connected, after which, a "connect" event will be fired.
   *
   * @function Galil#connect
   * @emits connect when successful connection has been established.
   * @emits error when an error in connection occurs.
   * @returns {Promise}
   *
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
    return Promise.map(Object.entries(this.sockets), entry => {
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
   * @function disconnect
   */
  disconnect() {
    return Promise.map(Object.entries(this.sockets), entry => {
      return new Promise((resolve, reject) => {
        const [ name, socket ] = entry;
        socket.stopReconnecting();
        socket.once('close', resolve)
        socket.end();
        socket.destroy();
      });
    }).then(() => this.emit('disconnect'));
  }
  async sendCommand(command, timeout=5000) {
    return await this.commands.send(command, timeout);
  }
}
