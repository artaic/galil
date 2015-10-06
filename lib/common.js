if (_.isUndefined(Galil)) {
  if (Meteor.isServer) {
    let EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    Galil = {};
  }

  Galil.config = {};
  Galil.connections = new Mongo.Collection('galil_socket_connections');

  Galil.connections.find().observe({
    added: function (document) {
      Meteor._debug(`[${document.name}]\tNew connection added`);
    },
    changed: function (newDoc, oldDoc) {
      if (Meteor.isClient) {
        if (_.all(Galil.connections.find().map((doc) => doc.executing))) {
          Galil._executing.set(true);
        }

        // this finds the last message to be written, keeping in mind that you can write multiple messages at once
        // Therefore, this will always be an array.
        let newMessages = _.clone(newDoc.messages), oldMessages = _.clone(oldDoc.messages);
        while (JSON.stringify(oldMessages) !== JSON.stringify(newMessages.slice(0, oldMessages.length))) {
          oldMessages.shift();
        }
        Galil._lastMessage.set(newMessages.slice(oldMessages.length));

        // Updates the `Galil.status()` reactiveVar
        let connStatus = Galil.connections.find().map((doc) => doc.status);

        // if every socket is connected, then assume it's connected.
        if (_.all(connStatus, (status) => status === 'connected')) {
          Galil._status.set({
            connected: true,
            status: 'connected',
            reason: null
          });
        }

        // if any of them aren't connected, then it's really not connected
        // this is on the `closed` callback
        if (_.any(connStatus, (status) => status === 'failed')) {
          Galil._status.set({
            connected: false,
            status: 'failed',
            reason: 'ConnectionError'  // to do: use an actual error message here.
          });
        }
      }
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
