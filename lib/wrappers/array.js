let Fiber = Npm.require('fibers');
let Future = Npm.require('fibers/future');

_.extend(Galil, {
  /**
   * Lists all of the allocated arrays on the controller
   *
   * @module Server/Galil.array
   * @method list
   */
  listArrays: function () {
    return this.sendCommand('LA');
  },

  /**
   * Download an array to the controller
   *
   * @module Server/Galil.array
   * @method downloadArray
   * @param {String} arrayName the name of the array to update
   * @param {Array} DMArray what to set the values to
   * @throws Match.Error if the type check fails.
   * @example
   * Galil.downloadArray('order', _.range(0, 300, 0));
   */
  downloadArray: function (arrayName, dmArray) {
    check(arrayName, String);
    check(dmArray, Array);

    this.sendCommand(`QD ${arrayName}[]\r${dmArray.join(',')}\\`);
  },

  /**
   * Upload (read) a series of array values
   *
   * @module Server/Galil.array
   * @method upload
   * @param {String} arrayName the name of the array to upload
   * @throws Match.Error if the array name is not a string
   */
  uploadArray: function (arrayName) {
    check(arrayName, String);

    let results = '';
    let future = new Future();
    let done = future.resolver();

    const encodings = this._encodings;

    let parseData = function (data) {
      let str = _.trim(data.toString('ascii')).split('\r');
      let status = _.last(str);
      results += data.toString('ascii');
      if (status === encodings.done) {
        done(null, results.split('\r').map((s) => s.replace(String.fromCharCode('32'), '')).slice(0, -1));
      } else if (status === encodings.error) {
        done(new Meteor.Error(`GalilError`, `Command not recognized`));
      }
    }

    this._commands.addListener('data', Meteor.bindEnvironment(parseData));
    this._commands.write(`QU ${arrayName}[]\r`);

    future.wait();

    this._commands.removeListener('data', Meteor.bindEnvironment(parseData));

    return future.value;
  }
});
