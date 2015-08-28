 _.extend(Galil.config, {
   parser: {
    _linesep: /\r\n/g,
    _delimiter: ':',
    _invalid: '?'
   }
});

Object.defineProperties(Galil.config.parser, {
  linesep: {
    get: function () {
      return this._linesep;
    },
    set: function (val) {
      check(val, Match.OneOf(String, RegExp));
      this._linesep = val;
    }
  },
  delimiter: {
    get: function () {
      return this._delimiter;
    },
    set: function (val) {
      check(val, String);
      this._delimiter = val;
    }
  },
  invalid: {
    get: function () {
      this._invalid
    },
    set: function (val) {
      check(val, String);
      this._invalid = val;
    }
  }
});

/**
 * Parses a message to something more readable by javascript
 *
 * @method message
 * @module Parsers
 * @returns {Array} an array of parsed messages
 * @example
 * Galil._messages.on('data', (data) => {
 *   console.log(this.parse(data));
 * });
 *
 * ['Start', 'Unload']
 */
Galil.parse = function (data) {
  check(data, Match.OneOf(String, Buffer));

  let conf = this.config.parser;
  let str = _.trim(data.toString('ascii'));
  if (str === conf._invalid) {
    return ['Error', 'Command not recognized'];
  } else if (str === ':') {
    return ['Ok'];
  } else {
    return _.trim(data.toString('ascii')).split(conf._linesep);
  }
}

