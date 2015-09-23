Package.describe({
  name: 'insightfil:galil',
  version: '0.2.4',
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
    'erasaur:meteor-lodash@3.10.1'
  ]);

  api.export('Galil', both);

  api.addFiles([
    'lib/common.js',
    'lib/parser.js'
  ], both);

  api.addFiles([
    'lib/server.js',
    'lib/wrappers/array.js'
  ], 'server');
});

Package.onTest(function(api) {
  api.use(['practicalmeteor:munit', 'ecmascript', 'erasaur:meteor-lodash']);
  api.use('insightfil:galil');

  api.addFiles(['test/init.js', 'test/connection.js']);
});
