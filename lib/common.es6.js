if (_.isUndefined(Galil)) {
  if (Meteor.isServer) {
    let EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    Galil = {};
  }

  Galil.config = {};
  Galil.collection = new Mongo.Collection('galil_messages');

  if (Meteor.isServer) {
    Meteor.settings = Meteor.settings || {};
    _.defaults(Meteor.settings, {
      galil: {
        connection: {
          port: Number(process.env.GALIL_PORT),
          host: process.env.GALIL_HOST
        },
        defaultTimeout: 60 * 1000
      }
    });

    let conn = Meteor.settings.galil.connection;
    if (!conn.port || !conn.host) {
      throw new Meteor.Error(500, `Host or port not specified on settings ${conn}`)
    }

    _.extend(Galil.config, Meteor.settings.galil);
  }
}

