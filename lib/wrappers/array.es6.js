if (Meteor.isServer) {
  let Promise = Npm.require('bluebird');

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

    printArray: function (arrName) {
    },

    /**
     * Download an array to the controller
     *
     * @module Server/Galil.array
     * @method download
     * @param {String} arrayName the name of the array to update
     * @param {Array} DMArray what to set the values to
     * @throws Match.Error if the type check fails.
     */
    downloadArray: function (arrayName, dmArray) {
      check(arrayName, String);
      check(dmArray, Array);

      Promise.map(dmArray, (val, index) => {
        return `${arrayName}[${index}]=${val}`;
      }, { concurrency: 1 }).each((command) => {
        this.sendCommand(command);
      });
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

  Meteor.methods({
    'Galil.array.list': Galil.listArrays.bind(Galil),
    'Galil.array.print': Galil.printArray.bind(Galil),
    'Galil.array.download': Galil.downloadArray.bind(Galil),
    'Galil.array.upload': Galil.uploadArray.bind(Galil)
  });
} else {
  Galil.array = {
    list: () => Galil._galilMethodAsync('Galil.array.list'),
    print: (name) => Galil._galilMethodAsync('Galil.array.print', name),
    download: (name, arr) => Galil._galilMethodAsync('Galil.array.download', [name, arr]),
    upload: (name) => Galil._galilMethodAsync('Galil.array.upload', name)
  }
}
