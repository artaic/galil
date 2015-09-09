/**
 * Wrapper around client methods.
 * Makes sure that all methods will return promisified data
 *
 * @method _galilMethodAsync
 * @private
 */

if (Meteor.isServer) {
  Meteor.methods({
    'Galil.execute': Galil.execute.bind(Galil),
    'Galil.sendCommand': Galil.sendCommand.bind(Galil),
    'Galil.sendCommands': Galil.sendCommands.bind(Galil),
    'Galil.array.download': Galil.downloadArray.bind(Galil),
    'Galil.array.upload': Galil.uploadArray.bind(Galil),
    'Galil.array.list': Galil.listArrays.bind(Galil)
  });
} else {
  let _galilMethodAsync = function (method, data) {
    check(method, String);

    let args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      Meteor.apply(method, args, {
        wait: true,
        onResultsReceived: () => {
          console.log('Received results');
        }
      }, function (err, resp) {
        err ? reject(err) : resolve(resp);
      });
    });
  }

  _.extend(Galil, {
    execute: (program, cb) => _galilMethodAsync('Galil.execute', program),
    sendCommand: (command) => _galilMethodAsync('Galil.sendCommand', command),
    sendCommands: (commands) => _galilMethodAsync('Galil.sendCommands', commands),
    array: {
      download: (arrayName, array) => _galilMethodAsync('Galil.array.download', arrayName, array),
      upload: (arrayName) => _galilMethodAsync('Galil.array.upload', arrayName),
      list: () => _galilMethodAsync('Galil.array.list')
    }
  });
}

