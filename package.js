Package.describe({
  name: 'insightfil:galil',
  version: '1.2.0',
  summary: 'Interact with the Galil controller',
  git: 'https://github.com/artaic/Galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.0.1');
  var both = ['client', 'server'];

  api.use([
    'mongo',
    'check',
    'ecmascript',
    'es5-shim',
    'promise',
    'tracker',
  ], both);

  api.use('reactive-var', 'client')

  api.export(['Galil', 'GalilConnections'], both);
  api.export('GalilServer', 'server');
  // api.export('GalilClient', 'client');

  api.addFiles('lib/common.js', both);
  api.addFiles([
    'lib/socket.js', 'lib/server.js'
  ], 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('mongo');
  api.use('insightfil:galil');

  api.addFiles([
    'tests/connection.js'
  ], 'server');
});

Npm.depends({
  'xregexp': '3.0.0'
});

