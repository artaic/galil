const util = Npm.require('util');
const Socket = Npm.require('net').Socket;
const Future = Npm.require('fibers/future');

GalilSocket = class GalilSocket extends Socket {
  constructor(name, address) {
    super();
    check(name, String);

    this.setEncoding('ascii');

    this._name = name;
    this._delimiter = /(?:\r\n)+/;  // this is what every message contains and can be split on.
    this._address = address;

    this._connections = GalilConnections;

    this._connections.upsert({ name: this._name }, {
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

    this.on('close', Meteor.bindEnvironment(hasError => {
      Meteor.setTimeout(() => this.emit('reconnect'), 4000);
    })).on('end', Meteor.bindEnvironment(() => {
      Meteor.setTimeout(() => this.emit('reconnect'), 4000);
    })).on('error', Meteor.bindEnvironment(error => {
      this._update({
        $set: {
          'connection.reason': error.message,
          'connection.status': 'failed'
        }
      }).disconnect();
    })).on('connect', Meteor.bindEnvironment(() => {
      this._update({
        $set: {
          'connection.status': 'connected',
          'connection.retryCount': 0,
          'connection.retryTime': null,
          'connection.reason': null
        },
      });
    })).on('reconnect', Meteor.bindEnvironment(n => {
      console.log('Attempting a reconnect.')
      this._update({
        $set: {
          'connection.status': 'connecting',
          'connection.retryTime': new Date(),
        },
        $inc: {
          'connection.retryCount': 1
        }
      });
      super.connect(this._address);
    })).on('data', Meteor.bindEnvironment(data => {
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
  }
  _update(operator) {
    this._connections.update({ name: this._name }, operator)
    return this;
  }
  connect() {
    return new Promise((resolve, reject) => {
      this._connections.update({ name: this._name }, {
        $set: {
          'connection.status': 'connecting',
          'connection.retryTime': new Date()
        }
      });
      this.once('connect', resolve).once('error', reject);
      super.connect(this._address);
    });
  }
  disconnect() {
    this.destroy();
    this.unref();
    return this;
  }
  reconnect() {
    this._connections.update({ name: this._name }, {
      $set: {
        'connection.retryTime': new Date(),
        'connection.retryCount': 0
      }
    });
    this.disconnect();
    return this.connect();
  }
  send(command, timeout=60000) {
    check(command, String);
    check(timeout, Number);

    let listener = function(){};
    let timeoutId;

    const responses = {
      error: /^(?:\?)\s?$/m,
      success: /^(?:\:)\s?$/m
    };

    return new Promise((resolve, reject) => {
      timeoutId = Meteor.setTimeout(() => {
        reject(new Meteor.Error(408, "Timeout exceeded"));
      }, timeout);

      listener = Meteor.bindEnvironment(function (data) {
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
