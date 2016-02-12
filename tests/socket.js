const NAME = 'test';
const Server = Npm.require('net').Server;

class GalilServer extends Server {
  constructor() {
    super(...arguments);
    this._connectedClients = new Set();
    this._commands = new Set([
    ]);

    this.once('listening', Meteor.bindEnvironment(() => {
      const addConnection = Meteor.bindEnvironment(client => {
        this._connectedClients.add(client);
      });

      this.on('connection', addConnection);

      this.on('close', Meteor.bindEnvironment(() => {
        this.removeListener('connection', addConnection);
        this._connectedClients.forEach(connection => connection.destroy());
        this._connectedClients.clear();
      }));
    }));
  }
  get clients() {
    return this._connectedClients;
  }
}

Tinytest.add('GalilSocket and GalilConnections should export', function (test) {
  test.isNotUndefined(GalilSocket);
  test.isNotUndefined(GalilConnections);
  test.instanceOf(GalilConnections, Mongo.Collection);
});

Tinytest.add('Instancing a GalilSocket should upsert document', function (test) {
  GalilConnections.remove({ name: NAME });
  test.isUndefined(GalilConnections.findOne({ name: NAME }));
  const socket = new GalilSocket(NAME);
  const doc = GalilConnections.findOne({ name: NAME });
  test.isNotUndefined(doc);
});

Tinytest.addAsync('Should be able to connect to a socket server', function (test, done) {
  const server = new GalilServer();
  server.listen(8124, Meteor.bindEnvironment(() => {
    const socket = new GalilSocket(NAME);
    socket.once('connect', Meteor.bindEnvironment(() => {
      server.close();
      test.isFalse(socket._connecting);
      done();
    }));
    socket.connect(server.address());
  }));
});

Tinytest.addAsync('Should attempt reconnection when the server closes', function (test, done) {
  const server = new Server();

  server.listen(8124, Meteor.bindEnvironment(() => {
    const socket = new GalilSocket(NAME);
    socket.once('connect', Meteor.bindEnvironment(() => {
      console.log('Connected.');
      server.close();
      done();
    }));
    socket.connect(server.address());
  }));
});

Tinytest.addAsync('Should write message when receiving response', function (test, done) {
  const server = new GalilServer();
  server.listen(8124, Meteor.bindEnvironment(() => {
    const socket = new GalilSocket(NAME);
    socket.once('connect', Meteor.bindEnvironment(() => {
      socket.once('data', Meteor.bindEnvironment((data) => {
        console.log(data);
        server.close();
        done();
      }));
      server.write('Hello\r\n');
    }));
    socket.connect(server.address());
  }));
});
