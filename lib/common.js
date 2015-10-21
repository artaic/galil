if (_.isUndefined(Galil)) {
  /**
   * Galil controller for server methods
   * @module Galil
   * @extends EventEmitter
   * @author Alex Frazer
   */
  if (Meteor.isServer) {
    const EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    Galil = {};
  }

  Galil.Connections = new Mongo.Collection('galil_connections');
  Galil.Devices     = new Mongo.Collection('galil_devices');
  Galil.config      = {};

  if (Meteor.isServer) {
    Meteor.settings = Meteor.settings || {};
    // ensure that there can only be a single primary device
    Galil.Devices._ensureIndex({ primary: 1 }, { unique: 1 });
    Galil.Devices.upsert({
      connection: Meteor.settings.galil.connection
    }, {
      $set: {
        primary: true,
        connection: Meteor.settings.galil.connection,
        config: {
          defaultTimeout: 60 * 1000,
          messageLimit: 50,
          maxRetries: 5
        }
      }
    });
  }
}
