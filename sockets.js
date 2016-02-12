const util = Npm.require('util');
const colors = Npm.require('colors');
const XRegExp = Npm.require('xregexp');
const Socket = Npm.require('net').Socket;

GalilSocket = class GalilSocket extends Socket {
  constructor(name) {
    super();
    this.setEncoding('ascii');

    check(name, String);
    this._name = name;
    this._delimiter = /(?:\r\n)+/;  // this is what every message contains and can be split on.
    this._connections = GalilConnections;
    this._createOrUpdateDocument();

    let listen = Meteor.bindEnvironment((data) => {
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
    });

    this.removeListener('data', listen);
    this.on('data', listen);
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
          'connection.address': this.address(),
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
    this.destroy();
    this.emit('disconnect');
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
