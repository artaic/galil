/**
 * @module Galil
 * @property {Object} config the configuration object
 * @property {Object} config.parser the parser configuration
 * @property {RegExp} config.parser.linesep What separates each message
 * @property {String} config.parser.delimiter what to use to separate each component part of each message
 * @property {String} config.parser.invalid the response from an invalid command
 * @property {RegExp} config.parser.error matches an error.
 */
_.extend(Galil.config, {
   parser: {
    _linesep: /(?:\r\n)/g,
    _delimiter: ':',
    _invalid: '?',
    _error: /(?:(^\w+)(?:\:)*(\w+)*(:\w+)*)[\r\n]+/gm
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
  let str = _.trim(data.toString('ascii').replace('\n', '')).split('\r');
  return str;
}

