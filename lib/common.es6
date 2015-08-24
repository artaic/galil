GalilMessages = new Mongo.Collection('galil_messages');

if (Meteor.isServer) {
  GalilMessages._createCappedCollection('galil_messages', 10000000, 200);
}

