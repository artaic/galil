/**
 * Client library for Galil
 * Contains mostly reactive data sources
 */

Galil._status = new ReactiveVar({ connected: false });
Galil._executing = new ReactiveVar(false);

Galil.executing = function () {
  return Galil._executing.get();
};

Galil.status = function () {
  return Galil._status.get();
}

function setConnectionStatus (doc) {
  const status = Galil.Connections.find({}, {
    fields: {
      'connection.status': 1,
      'connection.retryCount': 1,
      'connection.reason': 1,
    }
  }).map((doc) => _.extend(doc.connection, {
    connected: doc.connection.status === 'connected'
  })).reduce(function (result, socket) {
    result.sockets.push(socket);
    result.connected = _.all(result.sockets, (s) => s.connected);
    return result;
  }, {
    connected: false,
    sockets: []
  });
  Galil._status.set(status);
}
/**
 * Every time the connections are updated or added, update reactive data sources
 */
Galil.Connections.find({
}).observeChanges({
  added: setConnectionStatus,
  changed: setConnectionStatus
});

Galil.Devices.find({ primary: true }).observe({
  changed: function (doc) {
    Galil._executing.set(doc.executing);
  }
});

