Galil._connected = false;
Galil._messages._connected = false;
Galil._commands._connected = false;

/**
 * Decides the connection status of the galil controller.
 * @method setConnectionStatus
 */
function setConnectionStatus(socket, event) {
  let args = Array.prototype.splice.call(arguments);
  socket._connected = event === 'connect';
  this._connected = this._messages._connected && this._commands._connected;
  this._connected ? this.emit('connect') : this.emit('close');
}

Galil._messages.addListener('connect', setConnectionStatus.bind(Galil, Galil._messages, 'connect'));
Galil._commands.addListener('connect', setConnectionStatus.bind(Galil, Galil._commands, 'connect'));

Galil._messages.addListener('close', setConnectionStatus.bind(Galil, Galil._messages, 'close'));
Galil._commands.addListener('close', setConnectionStatus.bind(Galil, Galil._commands, 'close'));

