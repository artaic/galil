GalilConnections = new Mongo.Collection('galil_connections');
GalilBase = class GalilBase {
  constructor(/** arguments */) {
    this._id = Random.id();
    if (Match.test(arguments[0], Object)) {
      check(arguments[0], Match.ObjectIncluding({
        port: Number,
        host: String
      }));
      this.connection = arguments[0];
    } else {
      check(arguments[0], Number);
      check(arguments[1], String);
      this.connection = { port: arguments[0], host: arguments[1] };
    }
    this.Connections = GalilConnections;
  }
}

if (Meteor.isServer) {
  Meteor.publish(null, function () {
    return GalilConnections.find();
  });
}
