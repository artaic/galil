/**
 * Wrapper around client methods.
 * Makes sure that all methods will return promisified data
 *
 * @method _galilMethodAsync
 * @private
 */
let _galilMethodAsync = function (method, data) {
  check(method, String);

  if (!_.isArray(data)) {
    data = [data];
  }

  return new Promise(function (resolve, reject) {
    Meteor.apply(`Galil.${method}`, data, {
      wait: true,
      onResultsReceived: function () {
        console.log('OK', 'color: green;');
      }
    }, function (err, resp) {
      err ? reject(err) : resolve(resp);
    });
  });
}

/**
 * Sends a command to the controller from the client
 *
 * @module Client/Galil
 * @method sendCommand
 * @param {String|Array} command the command to send to the controller
 * @returns {Promise} a promise containing the result.
 * @example
 * > Galil.sendCommand('MG "Hello World!"').then(function () {
 *    console.log('Sent command!');
 * });
 */
Galil.sendCommand = function (command) {
  return _galilMethodAsync('sendCommand', command);
}

Galil.downloadArray = function (arrName, arrayData) {
  return _galilMethodAsync('downloadArray', arrName, arrayData);
}

