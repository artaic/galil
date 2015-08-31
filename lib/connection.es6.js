Galil.connected = false;
Galil._messages._connected = false;
Galil._commands._connected = false;

/**
 * Decides the connection status of the galil controller.
 * @method setConnectionStatus
 */
let setConnectionStatus = Meteor.bindEnvironment(function (socket, status) {
  Galil.connections.update({ name: socket._name }, { $set: { status: status }});
  let connected = _.all(Galil.connections.find().map((doc) => doc.status === 'connected'));
  Galil.emit(connected ? 'connect' : 'close');
});

Galil._messages.addListener('connect', setConnectionStatus.bind(Galil, Galil._messages, 'connected'));
Galil._commands.addListener('connect', setConnectionStatus.bind(Galil, Galil._commands, 'connected'));

Galil._messages.addListener('close', setConnectionStatus.bind(Galil, Galil._messages, 'disconnected'));
Galil._commands.addListener('close', setConnectionStatus.bind(Galil, Galil._commands, 'disconnected'));

