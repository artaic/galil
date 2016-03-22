import {Mongo} from 'meteor/mongo';
import {check, Match} from 'meteor/check';
import {EventEmitter} from 'events';

export const Devices = new Mongo.Collection('galil.devices');
export const Connections = new Mongo.Collection('galil.connections');

export class GalilCommon extends EventEmitter {
  constructor(config) {
    super(...arguments);
    this._address = config;
    this._connections = Connections;
  }
}

export default GalilCommon;
