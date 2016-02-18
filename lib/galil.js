const EventEmitter = Npm.require('events').EventEmitter;
const XRegExp = Npm.require('xregexp');
const Future = Npm.require('fibers/future');
const colors = Npm.require('colors');

Galil = class Galil extends EventEmitter {
  constructor(options) {
    super(...arguments);

    this._hooks = {
      connect: new Set(),
      disconnect: new Set()
    }

    this._messages = new GalilSocket('messages');
    this._commands = new GalilSocket('commands');

    this.on('connect', Meteor.bindEnvironment(() => {
      this._hooks.connect.forEach(fn => fn.call(this));
    }));

    this._messages.on('data', Meteor.bindEnvironment(data => {
      data.split(this._messages._delimiter).filter(Boolean).forEach(message => {
        this.emit('message', message);
      });
    }));
  }
  connect() {
    // gotta do something when the close event occurs
    const onClose = Meteor.bindEnvironment(() => {
    });

    this._commands.once('connect', Meteor.bindEnvironment(() => {
      this._messages.once('connect', Meteor.bindEnvironment(() => {
        this._messages.send('CF I').then(res => {
          this.emit('connect');
        });
      })).connect(...arguments);
    })).connect(...arguments);
  }
  // adds a hook to be called on the connect event
  onConnect(fn) {
    check(fn, Function);
    this._hooks.connect.add(fn);
  }
  onDisconnect(fn) {
    check(fn, Function);
    this._hooks.disconnect.add(fn);
  }
  awaitMessage(regex, timeout=60000) {
    check(regex, RegExp);
    check(timeout, Number);

    let timeoutId;
    let callback;

    return new Promise((resolve, reject) => {
      timeoutId = Meteor.setTimeout(() => {
      }, timeout);

      callback = Meteor.bindEnvironment(data => {
        if (regex.test(data)) {
          resolve(data);
        }
      });

      this.on('message', callback);
    }).finally(() => {
      Meteor.clearTimeout(timeoutId);
      this.removeListener('message', callback);
    });
  }
  sendCommand(command, timeout=60000) {
    return Promise.await(this._commands.send(command, timeout));
  }
  execute(subroutine, regex, timeout=60000) {
    check(subroutine, String);
    check(regex, RegExp);
    Promise.await(this.sendCommand(`XQ#${subroutine}`));
    return Promise.await(this.awaitMessage(regex, timeout));
  }
}
