if (_.isUndefined(Galil)) {
  if (Meteor.isServer) {
    /**
     * Galil controller for server methods
     * @module Server/Galil
     * @extends EventEmitter
     * @author Alex Frazer
     */
    const EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    /**
     * Galil controller for client methods
     * @module Client/Galil
     * @author Alex Frazer
     */
    Galil = {};
  }

  Galil.config = {};

  Galil.connections = new Mongo.Collection('galil_socket_connections');
  Galil.devices = new Mongo.Collection('galil_devices');

  if (Meteor.isServer) {
    Meteor.settings = Meteor.settings || {};

    Galil.devices._ensureIndex({ primary: 1, unique: 1 });
    Galil.devices.upsert({
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
