const Socket = Npm.require('net').Socket;
/**
 * @class GalilSocket
 * @extends net.Socket
 */
GalilSocket = class GalilSocket extends Socket {
  constructor(name, options={}) {
    super(...arguments);
    this._name = name;
    this._config = Object.assign(options, {
      retryTime: 30000,
      maxRetries: 5,
      messageLimit: 500
    });

    GalilConnections.upsert({ name: name }, {
      $set: {
        'connection.status': 'offline',
        'connection.reason': null,
        'connection.retryCount': 0
      },
      $setOnInsert: {
        'messages': [],
        'tail': []
      }
    });
  }
  connect() {
    this.removeAllListeners();
    this._connector = [...arguments];

    GalilConnections.update({ name: this.name }, {
      $set: { 'connection.status': 'connecting' }
    });

    this.on('connect', Meteor.bindEnvironment(() => {
      GalilConnections.update({ name: this._name }, {
        $set: {
          'connection.status': 'connected',
          'connection.retryCount': 0,
        },
        $unset: { 'connection.reason': null }
      });
    })).on('data', Meteor.bindEnvironment(data => {
      const messages = data.toString('ascii').replace(/\n/g, '\r').split(/\r+/)
        .filter(s => s != undefined && s.trim() != '')
        .map(s => ({ message: s, timestamp: new Date() }));

      GalilConnections.update({ name: this.name }, {
        $push: {
          messages: {
            $each: messages,
            $sort: { timestamp: 1 },
            $slice: (this._config.messageLimit || 50) * -1
          }
        },
        $set: { tail: messages }
      });
    })).on('error', Meteor.bindEnvironment(() => {
      const retries = this.collection.findOne({ name: this.name }).connection.retryCount;
      if (retries > this.config.maxRetries) {
        this.removeAllListeners();
        GalilConnections.update({ name: this.name }, {
          $set: {
            'connection.status': 'failed',
            'connection.reason': err.message
          }
        });
      }
    })).on('close', Meteor.bindEnvironment(() => {
      if (retries < this.config.maxRetries) {
        Meteor.setTimeout(() => {
          this.collection.update({ name: this.name }, {
            $set: {
              'connection.status': 'connecting',
              'connection.retryTime': new Date
            },
            $inc: { 'connection.retryCount': 1 }
          });
          super.connect(...args);
        }, this.config.timeout);
      }
    })).on('end', Meteor.bindEnvironment(() => {
    }));
    return super.connect(...arguments);
  }
  disconnect() {
    super.destroy();
  }
  reconnect() {
    GalilConnections.update({ name: this.name }, {
      $set: { 'connection.retryCount': 0 },
      $unset: { 'connection.reason': null }
    });
    this.connect(this.connection);
  }
}
