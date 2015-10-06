let connectionSuite = {
  name: 'Connection of Galil controller',
  suiteTearDown: function () {
    Galil._messages = Galil._createConnection('messages');
    Galil._commands = Galil._createConnection('commands');
  },
  tests: [{
    name: 'Galil should be connected on initialization',
    type: 'server',
    func: function (test) {
    }
  }, {
    name: '`Galil._createConnection` should be able to create a valid connection',
    type: 'server',
    func: function (test) {
    }
  }]
}

Munit.run(connectionSuite);
