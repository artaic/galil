const net = Npm.require('net');
const Future = Npm.require('fibers/future');
const EventEmitter = Npm.require('events').EventEmitter;

Galil = class Galil extends EventEmitter {
  constructor(options) {
    super();

    check(options, Match.ObjectIncluding({
      port: Number,
      host: String
    }));

    this._options = options;
    this._commands = new GalilSocket('commands', options);
    this._messages = new GalilSocket('messages', options);

    // just for convenience
    // Splits the messages up
    this._messages.on('data', Meteor.bindEnvironment(data => {
      data.split(this._messages._delimiter)
        .filter(Boolean)
        .forEach(message => this.emit('message', message));
    }));
  }
  // fix me.
  _getErrorMessage() {
    return new Promise((resolve, reject) => {
      this._commands.once('data', data => {
        resolve(data.split('\r\n').filter(s => s!==':').join(''));
      }).write('TC1\r\n');
    });
  }
  connect() {
    // note: these will all start connecting at once
    // then when they're ALL ready, it will move on.
    Promise.await(Promise.all([
      this._commands.connect().catch(err => this._commands.reconnect()),
      this._messages.connect().catch(err => this._messages.reconnect())
    ]).then(() => this._messages.send('CF I')));
    this.emit('connect');
    return this;
  }
  disconnect() {
    this._messages.disconnect();
    this._commands.disconnect();
    this.emit('disconnected');
  }
  reconnect() {
    Promise.await(Promise.all([
      this._messages.reconnect(),
      this._commands.reconnect()
    ]));
    this.emit('reconnect');
  }
  /**
   * Sends a command and halts until confirmation is received.
   */
  sendCommand(command, timeout=60000) {
    try {
      Promise.await(this._commands.send(command, timeout));
    } catch (e) {
      if (e.error === 'GalilError') {
        const msg = Promise.await(this._getErrorMessage());
        throw new Meteor.Error('GalilError', msg);
      }
    }
    return this;
  }
  execute(subroutine, scanner, timeout=60000) {
    check(subroutine, String);
    check(scanner, Match.OneOf(RegExp, Function));

    Promise.await(this._commands.send(`XQ#${subroutine}`, timeout));

    const future = new Future();

    const callback = Match.test(scanner, Function)
      ? scanner.bind(future)
      : Meteor.bindEnvironment(function (data) {
        if (scanner.test(data)) {
          future.return(data);
        }
      });

    let timeoutId = Meteor.setTimeout(future.throw.bind(future, new Meteor.Error(408, "Timeout Exceeded")), timeout);

    future.resolve(() => {
      this.removeListener('message', callback);
      Meteor.clearTimeout(timeoutId);
    });

    this.on('message', callback);

    return future.wait();
  }
}
