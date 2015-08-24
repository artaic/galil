ServiceConfiguration.configurations.upsert(
  { service: 'galil' },
  { $set: { host: '192.168.1.3', port: 23 } }
);

Tinytest.add('Galil controller should exist on the server', function (test) {
  test.isNotUndefined(Galil);
  test.instanceOf(Galil, Object);
});

Tinytest.add('Galil should have a messages and commands socket', function (test) {
  test.isNotUndefined(Galil._messages);
  test.isNotUndefined(Galil._commands);
});

Tinytest.add('Setting the port should update the service configuration', function (test) {
  Galil.port = 25;
  test.equal(Galil.port, 25);
  test.equal(Galil.port, ServiceConfiguration.configurations.findOne({ service: 'galil' }).port);
});

Tinytest.add('Setting the host should update the service configuration', function (test) {
  Galil.host = '192.168.1.3';
  test.equal(Galil.host, '192.168.1.3');
  test.equal(Galil.host, ServiceConfiguration.configurations.findOne({ service: 'galil' }).host);
});
