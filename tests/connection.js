const net = Npm.require('net');
const Future = Npm.require('fibers/future');

let openSocketServer = function () {
  let future = new Future();
  let server = net.createServer();
  server.listen(Meteor.bindEnvironment(function () {
    future.return(server);
  }));
  return future.wait();
};

Tinytest.add('Should be able to connect to an open server', function (test) {
  let server = openSocketServer();
  Galil.connect({
    port: server.address().port,
    host: server.address().host
  });

  let messages = Galil.Connections.findOne({ name: 'messages' });
  let commands = Galil.Connections.findOne({ name: 'commands' });

  test.isTrue(commands.connection.status, 'Commands should be connected');
  test.isTrue(messages.connection.status, 'Messages should be connected');

  Galil.disconnect();
  server.close();
});

Tinytest.addAsync('Should re-attempt connection when the server closes a connection', function (test, done) {
  let server = openSocketServer();
  const retryCount = 3;
  let s = new GalilSocket('fake', Galil.Connections, {
    timeout: 2000,
    maxRetries: retryCount,
    messageLimit: 2
  });

  s.connect({
    host: server.address().address,
    port: server.address().port
  }, Meteor.bindEnvironment(function () {
    test.isTrue(Galil.Connections.findOne({ name: 'fake' }).connection.status, 'connected');
    _.range(retryCount).reduce((p, res) => p.then(() => new Promise((resolve, reject) => {
      server.close();
      console.log(s.findOne({ name: 'messages' }).connection.status);
      resolve();
    })), Promise.resolve()).then(function () {
      done();
    });
  }));
});
