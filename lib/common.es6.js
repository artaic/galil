if (_.isUndefined(Galil)) {
  if (Meteor.isServer) {
    let EventEmitter = Npm.require('events').EventEmitter;
    Galil = new EventEmitter();
  } else {
    Galil = {};
  }
  Galil.config = {};
  Galil.collection = new Mongo.Collection('galil_messages');
}

