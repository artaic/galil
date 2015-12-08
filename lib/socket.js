const Socket = Npm.require('net').Socket;

/**
 * Augments the basic net.Socket by binding data handlers and writing to the database.
 *
 * @class GalilSocket
 * @extends net.Socket
 */
GalilSocket = class GalilSocket extends Socket {
  constructor(id, name, options={}) {
    super(...arguments);
    this._name = name;
    this._device = id;
    this._config = Object.assign(options, {
      retryTime: 30000,
      maxRetries: 5,
      messageLimit: 500
    });

    GalilConnections.upsert({
      device: id,
      name: name
    }, {
      $set: {
        'device': id,
        'connection.status': 'offline',
        'connection.reason': null,
        'connection.retryCount': 0
      },
      $setOnInsert: {
        'messages': [],
        'tail': [],
        'messageCount': 0
      }
    });
  }
  _getSocket() {
    return GalilConnections.findOne({
      name: this._name,
      device: this._device
    });
  }
  _updateSocket(operator) {
    GalilConnections.update({
      name: this._name,
      device: this._device
    }, operator);
  }
  connect() {
    const args = Array.prototype.slice.call(arguments);
    this.removeAllListeners();

    this._updateSocket({
      $set: { 'connection.status': 'connecting' }
    })

    this.on('connect', Meteor.bindEnvironment(() => {
      this._updateSocket({
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

      this._updateSocket({
        $push: {
          messages: {
            $each: messages,
            $sort: { timestamp: 1 },
            $slice: (this._config.messageLimit || 50) * -1
          }
        },
        $set: { tail: messages },
        $inc: { messageCount: messages.length }
      });
    })).on('error', Meteor.bindEnvironment(() => {
      const retries = this._getSocket().connection.retryCount;
      if (retries > this._config.maxRetries) {
        this.removeAllListeners();
        this._updateSocket({
          $set: {
            'connection.status': 'failed',
            'connection.reason': err.message
          }
        });
      }
    })).on('close', Meteor.bindEnvironment(() => {
      const retries = this._getSocket().connection.retryCount;
      if (retries < this._config.maxRetries) {
        Meteor.setTimeout(() => {
          this._updateSocket({
            $set: {
              'connection.status': 'connecting',
              'connection.retryTime': new Date
            },
            $inc: { 'connection.retryCount': 1 }
          });
          super.connect(...args);
        }, this._config.timeout);
      }
    })).on('end', Meteor.bindEnvironment(() => {
    }));
    return super.connect(...arguments);
  }
  disconnect() {
    super.destroy();
  }
  reconnect() {
    this._updateSocket({
      $set: { 'connection.retryCount': 0 },
      $unset: { 'connection.reason': null }
    });
    this.connect(this.connection);
  }
}
