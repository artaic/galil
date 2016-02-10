let Future = Npm.require('fibers/future');
let Socket = Npm.require('net').Socket;

GalilSocket = class GalilSocket extends Socket {
  constructor(name) {
    super();

    this._name = name;
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

    this.on('data', Meteor.bindEnvironment(this._log))

    this.setEncoding('ascii');
  }
  _log(data) {
    GalilConnections.update({
      name: this._name
    }, {
      $push: {
        messages: {
          $each: data.split(/(?:\r\|\n)?/).map(message => ({
            message: message,
            timestamp: new Date()
          })),
          $sort: { timestamp: 1 }
        }
      },
      $set: {
        tail: data.split(/(?:\r|\n)?/)
      }
    });
  }
  connect() {
    const retryInterval = 5000;
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
        Meteor.setTimeout(this.connect(...arguments), retryInterval);
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
      this.removeListener('close', reconnect);
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
    }));

    super.connect(...arguments);
  }
  disconnect() {
    this.close();
  }
}
