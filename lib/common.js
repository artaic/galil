if (_.isUndefined(Galil)) {
  if (Meteor.isServer) {
    let EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    Galil = {};
  }

  Galil.config = {};
  Galil.connected = false;
  Galil.executing = false;
  Galil.connections = new Mongo.Collection('galil_socket_connections');

  Galil.connections.find().observe({
    changed: function (doc) {
      Galil.executing = doc.executing;
    }
  });

  if (Meteor.isServer) {
    Meteor.settings = Meteor.settings || {};
    lodash.defaults(Meteor.settings, {
      connection: {
        port: Number(process.env.GALIL_PORT),
        host: process.env.GALIL_HOST
      },
      defaultTimeout: 60 * 1000,
      messageLimit: 50
    });
  }
  lodash.defaults(Galil.config, Meteor.settings);
}
