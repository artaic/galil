if (Meteor.isServer) {
  s = new GalilServer();
  Meteor.startup(function () {
    s.clients.forEach(client => {
      client.destroy();
    });
    s.listen(8124, Meteor.bindEnvironment(() => {
      Galil.connect(s.address());
    }));
  });
}
