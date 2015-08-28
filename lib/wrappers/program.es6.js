/**
 * writes a list of all programs installed on the controller
 *
 * @module Server/Galil
 * @method listPrograms
 */
Galil.routines.list = function () {
  this.sendCommand('LL');
}

Galil.routines.variables = function () {
  this.sendCommands('LV');
}
