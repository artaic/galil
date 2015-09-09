if (_.isUndefined(Galil)) {
  if (Meteor.isServer) {
    let EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    Galil = {};
  }

  Galil.config = {};
  Galil.connected = false;
  Galil.connections = new Mongo.Collection('galil_socket_connections');

  let setConnectedStatus = function() {
    Galil.connected = _.all(Galil.connections.find().map((doc) => {
      doc.status === 'connected'
    }));
  }

  Galil.connections.find().observeChanges({
    added: setConnectedStatus,
    changed: setConnectedStatus,
    removed: setConnectedStatus
  });

  if (Meteor.isServer) {
    check(process.env.GALIL_HOST, String);
    check(process.env.GALIL_PORT, Match.OneOf(String, Number));
    _.defaults(Galil.config, {
      connection: {
        port: Number(process.env.GALIL_PORT),
        host: process.env.GALIL_HOST
      },
      defaultTimeout: 60 * 1000,
      messageLimit: 200
    });
  }
}