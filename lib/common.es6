if (_.isUndefined(Galil)) {
  Galil = {};
  Galil.collection = new Mongo.Collection('_galil_messages');
}

if (Meteor.isServer) {
  Galil.collection._createCappedCollection('_galil_messages', 10000000, 200);
}

