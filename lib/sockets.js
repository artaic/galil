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

    this._name = name;
    this._bindListeners();
    this._delimiter = /(?:\r\n)+/;  // this is what every message contains and can be split on.

    this._connections = GalilConnections;
    this._connections.upsert({
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
    }));

    this.on('error', Meteor.bindEnvironment(error => {
      this._connections.update({ name: this._name }, {
        $set: {
          'connection.reason': error.message,
          'connection.status': 'failed'
        }
      });
    }));
  }
  connect() {
    this._connections.update({ name: this._name }, {
      $set: {
        'connection.status': 'connecting',
        'connection.retryTime': new Date()
      }
    });

    this.once('connect', Meteor.bindEnvironment(() => {
      this._connections.update({
        name: this._name
      }, {
        $set: {
          'connection.status': 'connected',
          'connection.retryCount': 0,
          'connection.retryTime': null,
          'connection.reason': null
        },
      });
    })).on('close', Meteor.bindEnvironment(hasError => {
      const conn = this._connections.findOne({ name: this._name });
      if (conn.retryCount <= 5) {
        this.emit('reconnect', conn.retryCount);
      } else {
        this.emit('error', new Meteor.Error(408, "Max retries exceeded"));
      }
    })).on('reconnect', Meteor.bindEnvironment(() => {
      this._connections.update({
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
      super.connect(...arguments);
    }));
    super.connect(...arguments);
  }
  send(command, timeout=60000) {
    check(command, String);
    check(timeout, Number);

    let listener;
    let timeoutId;

    return new Promise((resolve, reject) => {
      timeoutId = Meteor.setTimeout(() => {
        reject(new Meteor.Error(408, "Timeout exceeded"));
      }, timeout);

      const responses = {
        error: /^(?:\?)\s?$/m,
        success: /^(?:\:)\s?$/m
      };

      listener = Meteor.bindEnvironment(data => {
        // use TC1 command to get the text of an error
        if (responses.error.test(data)) {
          reject(new Meteor.Error('GalilError', "Invalid Command"));
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
