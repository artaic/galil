let Fiber = Npm.require('fibers');
let Future = Npm.require('fibers/future');

Galil.prototype.listArrays = function () {
  return this.sendCommand('LA');
};

Galil.prototype.downloadArray = function (arrayName, dmArray) {
  check(arrayName, String);
  check(dmArray, Array);

  this.sendCommand(`QD ${arrayName}[]\r${dmArray.join(',')}\\`);
};

Galil.prototype.uploadArray = function (arrayName) {
  check(arrayName, String);

  let listener = function(){};

  return new Promise((resolve, reject) => {
    let entries = [];
    let str = '';
    listener = Meteor.bindEnvironment(data => {
      data.split(/\r/).forEach(token => entries.push(token));
      if (entries.indexOf(String.fromCharCode(26) + String.fromCharCode(58))) {
        resolve(entries);
      }
    });
    this._commands.on('data', listener);
    this._commands.send(`QU ${arrayName}[]`);
  }).finally(() => {
    console.log('Done');
    this._commands.removeListener('data', listener);
  });
}
