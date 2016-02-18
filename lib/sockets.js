const util = Npm.require('util');
const colors = Npm.require('colors');
const XRegExp = Npm.require('xregexp');
const Socket = Npm.require('net').Socket;
const Future = Npm.require('fibers/future');

GalilSocket = class GalilSocket extends Socket {
  constructor(name) {
    super();
    check(name, String);

    this.setEncoding('ascii');
    this._bindListeners();
    this._name = name;
    this._delimiter = /(?:\r\n)+/;  // this is what every message contains and can be split on.
    this._connections = GalilConnections;
    this._createOrUpdateDocument();
  }
  _bindListeners() {
    this.on('data', Meteor.bindEnvironment((data) => {
      const original = util.inspect(data, { showHidden: true });
      const tokens = data.split(this._delimiter).filter(Boolean);

      GalilConnections.update({
        name: this._name
      }, {
        $push: {
          messages: {
            $each: tokens.map(message => ({
              message: message,
              _original: original,
              timestamp: new Date()
            }))
          }
        },
        $set: { tail: tokens }
      });

      if (process.env.NODE_ENV === 'development') {
        tokens.forEach(message => {
          console.log(`  [${this._name.toUpperCase()}] ${message}`);
        });
      }
    }));
  }
  _createOrUpdateDocument() {
    GalilConnections.upsert({
      name: this._name
    }, {
      $set: {
        connection: {
          status: 'disconnected',
          retryCount: 0,
          retryTime: null,
          reason: null
        }
      },
      $setOnInsert: {
        messages: [],
        tail: [],
        name: this._name
      }
    });
  }
  connect() {
    GalilConnections.update({ name: this._name }, {
      $set: {
        'connection.status': 'connecting',
        'connection.retryTime': new Date()
      }
    });

    const retry = Meteor.bindEnvironment(() => {
      GalilConnections.update({
        name: this._name
      }, {
        $set: {
          'connection.status': 'connecting',
          'connection.retryTime': new Date(),
        },
        $inc: {
          'connection.retryCount': 1
        }
      });

      this.connect(...arguments);
    }.bind(this, Array.from(arguments)));

    this.removeListener('close', retry);

    this.once('connect', Meteor.bindEnvironment(() => {
      GalilConnections.update({
        name: this._name
      }, {
        $set: {
          'connection.status': 'connected',
          'connection.retryCount': 0,
          'connection.retryTime': null,
          'connection.reason': null
        },
      });
    })).once('error', Meteor.bindEnvironment(err => {
      this.removeListener('close', retry);
      GalilConnections.upsert({
        name: this._name
      }, {
        $set: {
          connection: {
            status: 'failed',
            reason: err.message
          }
        }
      });
    })).on('close', retry);

    super.connect(...arguments);
  }
  disconnect() {
  }
  reconnect() {
    this._connections.update({ name: this._name }, {
      $set: {
        'connection.status': 'connecting',
        'connection.retryCount': 0,
        'connection.retryTime': new Date(),
        'connection.reason': 'null'
      }
    });
    this.close();
  }
  listenFor(regex, cb) {
    check(regex, Match.OneOf(RegExp, XRegExp));
    check(cb, Function);

    const listener = Meteor.bindEnvironment(data => {
      data.split(this._delimiter).filter(Boolean).forEach(token => {
        if (regex.test(token)) {
          cb(regex.exec(token));
        }
      });
    });

    this.on('data', listener);

    return { stop: () => this.removeListener('data', listener) };
  }
  waitFor(regex) {
  }
  send(command, timeout=60000) {
    check(command, String);
    check(timeout, Number);

    let listener;
    let timeoutId;

    return new Promise((resolve, reject) => {
      timeoutId = Meteor.setTimeout(() => reject(new Meteor.Error(408, "Timeout exceeded")), timeout);

      const responses = {
        error: /^(?:\?)\s?$/m,
        success: /^(?:\:)\s?$/m
      };

      listener = Meteor.bindEnvironment(data => {
        if (responses.error.test(data)) {
          reject(new Meteor.Error(400, 'Invalid command'));
        } else if (responses.success.test(data)) {
          resolve(data);
        }
      });

      this.on('data', listener);
      this.write(`${command}\r\n`);
    }).finally(res => {
      this.removeListener('data', listener);
      Meteor.clearTimeout(timeoutId);
    });
  }
}
