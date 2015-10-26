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
}

Galil.Connections = new Mongo.Collection('galil_connections');
Galil.Devices     = new Mongo.Collection('galil_devices');
Galil.History     = new Mongo.Collection('galil_history');
Meteor.settings   = Meteor.settings || {};

if (_.has(Meteor.settings, 'galil.connection')) {
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


/**
 * Listen for a message to be emitted, then apply a callback.
 * This will return an observer with the method `stop` on it.
 * Call "stop" on this observer when you're done with it.
 *
 * @module Galil
 * @function Galil#listen
 *
 * @param {String} socket the socket to listen on. Can be either `messages` or `commands`.
 * @param {RegExp} expression the regular expression to watch for.
 * @param {Function} callback what to do on the message being found.
 *
 * @returns {Cursor.observe} a cursor observer
 */
Galil.listen = function (socket, expression, callback) {
  check(socket, String);
  check(expression, RegExp);
  check(callback, Function);

  let observer = Galil.Connections.find({
    name: socket
  }).observe({
    changed: function (doc) {
      doc.tail.forEach(function (m) {
        if (expression.test(m.message)) {
          callback(m.message);
        }
      });
    }
  });

  return observer;
}
