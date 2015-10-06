/**
 * Client library for Galil
 * Contains mostly reactive data sources
 */

Galil._status = new ReactiveVar({
  connected: false,
  status: 'offline',
  reason: null
});
Galil._executing = new ReactiveVar(false);
Galil._lastMessage = new ReactiveVar([]);

Galil.status = function () {
  return Galil._status.get();
};

Galil.executing = function () {
  return Galil._executing.get();
};

Galil.lastMessage = function () {
  return Galil._lastMessage.get();
}

