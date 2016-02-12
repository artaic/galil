let Fiber = Npm.require('fibers');
let Future = Npm.require('fibers/future');

Galil.listArrays = function () {
  return this.sendCommand('LA');
}

Galil.downloadArray = function (arrayName, dmArray) {
  check(arrayName, String);
  check(dmArray, Array);

  this.sendCommand(`QD ${arrayName}[]\r${dmArray.join(',')}\\`);
}

Galil.uploadArray = function (arrayName) {
  check(arrayName, String);

  let future = new Future();

  let chunkData = Meteor.bindEnvironment(data => {
    data.split().toArray().forEach(char => {
      console.log(char.charCodeAt(0));
    });
    future.return();
  });

  Galil._messages.on('data', chunkData);

  this._commands.write(`QU ${arrayName}[]\r`);

  future.resolve(() => Galil._messages.removeListener('data', chunkData));

  return future.wait();
}
