GalilConnections = new Mongo.Collection('galil_connections');

if (Meteor.isServer) {
  GalilConnections._ensureIndex({ name: 1 }, { unique: true });
}
