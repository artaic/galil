/**
 * Client library for Galil
 * Contains mostly reactive data sources
 */

Galil._status = new ReactiveVar({
  connected: false,
  sockets: []
});

Galil._executing = new ReactiveVar(false);

Galil.executing = function () {
  return Galil._executing.get();
};

Galil.status = function () {
  return Galil._status.get();
}

/**
 * Every time the connections are updated or added, update reactive data sources
 */
Galil.connections.find().observe({
  added: function (doc) {
    let status = Galil._status.get();
    status.sockets.push({
      status: doc.connection.status,
      retryCount: doc.connection.retryCount
    });
    status.connected = _.all(status.sockets.map((doc) => doc.status === 'connected'));
    Galil._status.set(status);
  },
  changed: function () {
    let sockets = Galil.connections.find({}, {
      fields: {
        'connection.status': 1,
        'connection.retryCount': 1
      }
    }).map((doc) => doc.connection);

    Galil._status.set({
      connected: _.all(sockets.map((doc) => doc.status === 'connected')),
      sockets: sockets
    })

    Galil._executing.set(_.all(Galil.connections.find().map((doc) => doc.executing)));
  }
});
