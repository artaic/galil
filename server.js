import {Socket} from "net";
import {Meteor} from "meteor/meteor";
import {check, Match} from "meteor/check";
import {GalilCommon, Connections} from "./common";
import {AsyncOperation} from "./subroutine";

export class GalilSocket extends Socket {
  constructor(name, address) {
    super();
    this.setEncoding('ascii');
    this._name = name;
    this._address = address;

    Connections.upsert({ name: this._name }, {
      $setOnInsert: {
        name: this._name,
        status: {
          connected: false,
          retryCount: 0,
          retryTime: null,
        },
        messages: []
      },
      $set: {
        'status.status': 'disconnected'
      }
    });
    this._publishMessages();
  }
  _update() {
    return Connections.update(...[{ name: this._name }].concat(Array.from(arguments)));
  }
  _publishMessages() {
    const socket = this;
    Meteor.publish(null, function () {
      const doc = Connections.findOne({ name: socket._name });
      this.added('galil.connections', doc._id, doc);
      const listener = Meteor.bindEnvironment(data => {
        data.split(/\r\n/).forEach(line => {
          try {
            const parsed = JSON.parse(line);
            this.changed('galil.connections', doc._id, Object.assign(Connections.findOne(doc._id), parsed));
          } catch (e) {
            this.changed('galil.connections', doc._id, Object.assign(Connections.findOne(doc._id), { data: line }));
          }
        });
      });
      socket.on('data', listener)

      this.ready();
      this.onStop(() => socket.removeListener('data', listener));
    });
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.once('connect', resolve).once('error', reject);
      super.connect(this._address);
    });
  }
  _send(command, timeout=60000) {
  }
  send(command, timeout=60000) {
    check(command, String);

    let timeoutId;
    let listener = Meteor.bindEnvironment(function(){});

    return new Promise((resolve, reject) => {
      Meteor.setTimeout(() => reject(new Meteor.Error(408, "Timeout Exceeded")), timeout);
      listener = Meteor.bindEnvironment(data => {
        data.split(/\r\n/).forEach(line => {
          if (/^\:$/.test(line)) resolve(command)
          if (/^\?$/.test(line)) reject(command)
        });
      });
      this.on('data', listener);
      this.write(`${command}\r\n`);
    }).finally(() => {
      Meteor.clearTimeout(timeoutId);
      this.removeListener('data', listener);
    });
  }
}

export class Galil extends GalilCommon {
  constructor() {
    super(...arguments);

    this._messages = new GalilSocket('messages', this._address);
    this._commands = new GalilSocket('commands', this._address);
  }
  get commands() {
    return this._commands;
  }
  get messages() {
    return this._messages;
  }
  sockets() {
    return [this._messages, this._commands];
  }
  tellErrorCode() {
    return new Promise((resolve, reject) => {
      this._commands.once('data', Meteor.bindEnvironment(data => {
        resolve(data);
      }))
      this._commands.send('TC').catch(reject);
    });
  }
  async getError() {
    const error = await this.tellErrorCode();
    return error;
  }
  connect() {
    return Promise.all(this.sockets().map(socket => socket.connect()))
      .then(() => this._messages.send('CF I'))
      .then(() => this.emit('connect'));
  }
  async sendCommand(command, timeout=60000) {
    await this._commands.send(command, timeout);
  }
  subroutine() {
    return new AsyncOperation(...[this].concat(Array.from(arguments)));
  }
  async execute(subroutine, timeout=60000) {
    return await this.subroutine(...arguments).run();
  }
  downloadArray(arrayName, dmArray) {
    check(arrayName, String);
    check(dmArray, Array);

    this.sendCommand(`QD ${arrayName}[]\r${dmArray.join(',')}\\`);
  }
};

export default Galil;
