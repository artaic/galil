const EventEmitter = Npm.require('events').EventEmitter;
const XRegExp = Npm.require('xregexp');
const MeteorFuture = Npm.require('fibers/future');

class Future extends MeteorFuture {
  constructor() {
    super(...arguments);
  }
  timeout(milliseconds=60000) {
    let timeoutId = Meteor.setTimeout(() => {
      this.throw(new Meteor.Error(403, "Timeout Exceeded"));
    }, milliseconds);
    this.resolve(() => Meteor.clearTimeout(timeoutId));
    return this;
  }
}

/**
 * @TODO: probably export this as a class instead.
 */
Galil = {
  _logger: new Mongo.Collection('galil_history'),
  _commands: new GalilSocket('commands'),
  _messages: new GalilSocket('messages'),
  _responses: {
    error: /^(?:\?)\s?$/m,
    success: /^(?:\:)\s?$/m
  },
  connect() {
    this._messages.once('connect', Meteor.bindEnvironment(() => {
      this._messages.write('CF I\r');
    }));
    this._commands.connect(...arguments);
    this._messages.connect(...arguments);
  },
  disconnect() {
    this._commands.disconnect(...arguments);
    this._messages.disconnect(...arguments);
  },
  reconnect() {
    this._commands.reconnect(...arguments);
    this._messages.reconnect(...arguments);
  },
  sendCommand: function (command, timeout=60000) {
    check(command, String);
    check(timeout, Number);

    let listen;
    let timeoutId;

    return new Promise((resolve, reject) => {
      listen = Meteor.bindEnvironment(data => {
        if (this._responses.error.test(data)) {
          reject(new Meteor.Error(400, 'Invalid command'));
        } else if (this._responses.success.test(data)) {
          resolve(data);
        }
      });
      timeoutId = Meteor.setTimeout(() => reject(new Meteor.Error(408, `Timeout exceeded`)), timeout);

      this._commands.on('data', listen);
      this._commands.write(`${command}\r`);
    }).finally(() => {
      this._commands.removeListener('data', listen);
      Meteor.clearTimeout(timeoutId);
    });
  },
  awaitMessageSync: function (regex, timeout) {
    let listener;
    let timeoutId;

    return new Promise((resolve, reject) => {
      listener = Meteor.bindEnvironment(data => {
        if (regex.test(data)) resolve(regex.exec(data))
      });
      Meteor.setTimeout(() => reject(new Meteor.Error(408, `Timeout exceeded`), timeout), timeout);

      this._messages.on('data', listener);
    }).finally(res => {
      this._messages.removeListener('data', listener);
      Meteor.clearTimeout(timeoutId);
    });
  },
  execute: function (subroutine, regex, timeout=60000) {
    check(subroutine, String);
    check(regex, Match.OneOf(RegExp, XRegExp));
    check(timeout, Number);

    let future = new Future();

    Promise.all([
      this.sendCommand(`XQ#${subroutine}`, timeout),
      this.awaitMessageSync(regex, timeout)
    ]).then(future.return.bind(future)).catch(future.throw.bind(future));

    return future.wait();
  }
}
