const util = Npm.require('util');
const colors = Npm.require('colors');
const XRegExp = Npm.require('xregexp');
const Socket = Npm.require('net').Socket;

GalilSocket = class GalilSocket extends Socket {
  constructor(name) {
    super();

    this._name = name;
    this._delimiter = /(?:\r\n)+/;  // this is what every message contains and can be split on.

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
        tail: []
      }
    });

    this.setEncoding('ascii');

    this.on('data', Meteor.bindEnvironment(data => {
      const original = util.inspect(data, { showHidden: true });
      const tokens = data.split(this._delimiter).filter(Boolean);

      GalilConnections.update({
        name: this._name
      }, {
        $push: {
          messages: {
            $each: tokens.map(message => ({
              message: message,
              timestamp: new Date(),
              _original: original
            })),
            $sort: { timestamp: 1 }
          }
        },
        $set: {
          tail: tokens
        }
      });

      if (process.env.NODE_ENV === 'development') {
        tokens.forEach(message => {
          console.log(`  [${this._name.toUpperCase()}] ${message}`);
        });
      }
    }));
  }
  connect() {
    const RETRY_INTERVAL = 5000;
    const MAX_RETRIES = 5;

    const reconnect = Meteor.bindEnvironment(() => {
      const config = GalilConnections.findOne({ name: this._name });
      if (config.connection.retryCount > MAX_RETRIES) {
        GalilConnections.upsert({
          name: this._name
        }, {
          $set: {
            'connection.status': 'connecting',
            'connection.retryTime': new Date()
          },
          $inc: { 'connection.retryCount': 1 }
        });
        Meteor.setTimeout(this.connect(...arguments), RETRY_INTERVAL);
      } else {
        GalilConnections.upsert({
          name: this._name
        }, {
          $set: {
            'connection.status': 'failed',
            'connection.reason': 'Max retries exceeded'
          }
        });
      }
    });

    this.on('close', reconnect);

    this.once('connect', Meteor.bindEnvironment(() => {
      this.removeListener('close', reconnect);
      GalilConnections.upsert({
        name: this._name
      }, {
        $set: {
          connection: {
            status: 'connected',
            retryCount: 0,
            reason: null,
            address: this.address()
          }
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`Connected galil socket: ${this._name}`);
      }
    }));

    this.once('error', Meteor.bindEnvironment(err => {
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
      this.removeAllListeners();
    }));

    super.connect(...arguments);
  }
  disconnect() {
    this.once('close', Meteor.bindEnvironment(() => {
      GalilConnections.update({
        name: this._name
      }, {
        $set: {
          connection: {
            status: 'disconnected',
            reason: null,
            retryCount: 0,
            retryTime: null
          }
        }
      });
    }));
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
}
