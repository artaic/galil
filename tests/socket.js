const util = Npm.require('util');

describe('Socket initialization', function () {
  let name = 'test';
  beforeEach(function (test) {
    stubs.create('upsert', GalilConnections, 'upsert');
    stubs.create('update', GalilConnections, 'update');
  });
  afterEach(function (test) {
    stubs.restoreAll();
  });
  it('Should export GalilSocket as a valid class', function (test) {
    expect(GalilSocket).to.be.defined;
    expect(GalilConnections).to.be.defined;
  });
  it('Should attempt to upsert a document when instanced', function (test) {
    const socket = new GalilSocket(name);

    expect(stubs.upsert).to.have.been.calledWith({
      name: name
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
        name: name
      }
    });
  });
  it('Should initialize with a data event listener', function (test) {
    const socket = new GalilSocket(name);
    expect(socket._events.data).to.be.instanceof(Function);
  });
});

describe('Socket connection', function () {
  let name = 'test';
  let socket = new GalilSocket(name);
  let server = new GalilServer();

  beforeAll(function (test, waitFor) {
    server.listen(8124);
  });
  beforeEach(function () {
    socket = new GalilSocket(name);
    stubs.create('update', GalilConnections, 'update');
  });
  afterEach(function () {
    stubs.restoreAll();
    server.clients.forEach(client => client.destroy());
    socket = new GalilSocket(name);
  });
  afterAll(function () {
    server.close();
  });
  it('Should be able to connect to the server', function (test, waitFor) {
    const addr = server.address();
    socket.connect(addr, Meteor.bindEnvironment(waitFor(() => {
      expect(addr.port).to.be.equal(8124);
      expect(socket.remotePort).to.be.equal(8124);
      expect(stubs.update).to.have.been.calledWith({
        name: name
      }, {
        $set: {
          'connection.status': 'connected',
          'connection.retryCount': 0,
          'connection.retryTime': null,
          'connection.reason': null
        },
      });
    })));
  });
  it('Should attempt reconnect when the server closes', function () {
  });
});

describe('Writing to Socket', function () {
  let name = 'test';
  let socket = new GalilSocket(name);
  let server = new GalilServer();

  beforeAll(function (test, waitFor) {
    server.listen(8124, Meteor.bindEnvironment(() => {
    }));
  });
  beforeEach(function () {
    socket = new GalilSocket(name);
    stubs.create('update', GalilConnections, 'update');
  });
  afterEach(function () {
    stubs.restoreAll();
    server.clients.forEach(client => client.destroy());
    socket = new GalilSocket(name);
  });
  afterAll(function () {
    server.close();
  });
  it('Should write a message to the tail', function (test, waitFor) {
    socket.connect(server.address(), Meteor.bindEnvironment(waitFor(() => {
      socket.once('data', Meteor.bindEnvironment(data => {
        console.log(data);
      }));
    })));
  });
});
