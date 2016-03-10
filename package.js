Package.describe({
  name: 'insightfil:galil',
  version: '1.3.9',
  summary: 'Interact with the Galil controller',
  git: 'https://github.com/artaic/Galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use(['mongo', 'check', 'ecmascript', 'promise']);

  api.export('GalilConnections');
  api.export(['GalilSocket', 'Galil', 'GalilServer'], 'server');

  api.addFiles('lib/connections.js');
  api.addFiles([
    'lib/sockets.js',
    'lib/galil.js',
    'lib/array.js',
    'lib/server.js'
  ], 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use([
    'practicalmeteor:munit',
    'tulip:munit-helpers'
  ]);
  api.use('insightfil:galil');

  api.addFiles([
    'tests/socket.js'
  ], 'server');
});
