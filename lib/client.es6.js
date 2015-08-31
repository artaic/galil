/**
 * Wrapper around client methods.
 * Makes sure that all methods will return promisified data
 *
 * @method _galilMethodAsync
 * @private
 */

Galil._galilMethodAsync = function (method, data) {
  check(method, String);

  let args = Array.prototype.slice.call(arguments);

  if (!_.isArray(data)) {
    data = [data];
  }

  return new Promise(function (resolve, reject) {
    Meteor.apply(method, data, {
      wait: true,
      onResultsReceived: function () {
      }
    }, function (err, resp) {
      err ? reject(err) : resolve(resp);
    });
  });
}

_.extend(Galil, {
  execute: (program, cb) => Galil._galilMethodAsync('Galil.execute', program),
  sendCommand: (command) => Galil._galilMethodAsync('Galil.sendCommand', command),
  sendCommands: (commands) => Galil._galilMethodAsync('Galil.sendCommands', commands)
});

