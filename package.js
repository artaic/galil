Package.describe({
  name: 'insightfil:galil',
  version: '1.2.0',
  summary: 'Interact with the Galil controller',
  git: 'https://github.com/artaic/Galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use(['mongo', 'check', 'ecmascript', 'promise']);

  api.export('GalilConnections');
  api.export('GalilSocket', 'server');
  api.export('Galil', 'server');

  api.addFiles('connections.js');
  api.addFiles([
    'sockets.js',
    'galil.js',
    'array.js'
  ], 'server');
});

Package.onTest(function(api) {
  api.use(['practicalmeteor:munit', 'ecmascript', 'erasaur:meteor-lodash']);
  api.use('insightfil:galil');

  api.addFiles(['test/init.js', 'test/connection.js']);
});

Npm.depends({
  'xregexp': '3.0.0',
  'colors': '1.1.2'
});

