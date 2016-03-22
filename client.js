import {GalilCommon, Connections} from "./common";
import {EventEmitter} from "events";

export class GalilSocket extends EventEmitter {
  constructor(name) {
    super(...arguments);
    this._name = name;
  }
  get name() {
    return this._name;
  }
  async send() {
    return Meteor.promise(...[this, 'send'].concat(Array.from(arguments)));
  }
}

export class Galil extends GalilCommon {
  constructor() {
    super(...arguments);
    this._messages = new GalilSocket('messages');
    this._commands = new GalilSocket('commands');

    this._connections.find({ name: 'messages' }, {
      fields: { messages: 1 }
    }).observe({
      changed: doc => this.emit('message', doc.data)
    });
  }
  get messages() {
    return this._messages;
  }
  get commands() {
    return this._commands;
  }
  sockets() {
    return [this._commands, this._messages]
  }
  connect() {
  }
}

export default Galil;
