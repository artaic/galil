initSuite = {
  name: "Initialization of Galil controller",
  tests: [{
    name: 'Galil object should exist on both client and server',
    func: function (test) {
      test.isNotUndefined(Galil);
    }
  }, {
    name: 'Galil on the server should extend EventEmitter',
    type: 'server',
    func: function (test) {
      let EventEmitter = Npm.require('events').EventEmitter;
      test.instanceOf(Galil, EventEmitter);
    }
  }, {
    name: 'Galil should have a configuration',
    func: function (test) {
      test.isNotUndefined(Galil.config);
      test.instanceOf(Galil.config, Object);
    }
  }, {
    name: 'Configuration should have valid connection parameters',
    type: 'server',
    func: function (test) {
      console.log(Galil.config);
      test.isNotUndefined(Galil.config.connection);
      test.instanceOf(Galil.config.connection, Object);
      test.isNotUndefined(Galil.config.connection.port);
      test.isNotUndefined(Galil.config.connection.host);
    }
  }, {
    name: 'Galil should have a message and commands socket',
    type: 'server',
    func: function (test) {
      let Socket = Npm.require('net').Socket;
      test.isNotUndefined(Galil._messages);
      test.instanceOf(Galil._messages, Socket);

      test.isNotUndefined(Galil._commands);
      test.instanceOf(Galil._commands, Socket);
    }
  }]
}

Munit.run(initSuite);

