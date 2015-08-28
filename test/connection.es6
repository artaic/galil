connectionSuite = {
  name: 'Connection of Galil controller',
  suiteTearDown: function () {
    Galil._messages = Galil._createConnection('messages');
    Galil._commands = Galil._createConnection('commands');
  },
  tests: [{
    name: 'Galil should be connected on initialization',
    type: 'server',
    func: function (test) {
      test.isTrue(Galil._commands._connected);
      test.isTrue(Galil._messages._connected);
      test.isTrue(Galil._connected);
    }
  }]
}

Munit.run(connectionSuite);
