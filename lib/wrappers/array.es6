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
    return this.sendCommand(`QD ${arrayName}[]\r${dmArray.join(',')}\\`);
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
    this.sendCommand(`MG "Array ${arrayName}[]"`).then(() => {
      this.sendCommand(`QU ${arrayName}[]`);
    });
  }
});

