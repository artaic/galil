Package.describe({
  name: 'rtaic:galil',
  version: '0.0.1',
  summary: 'Interact with a Galil motion controller',
  git: 'https://github.com/artaic/galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  var both = ['client', 'server'];

  api.use(['mongo', 'check', 'grigio:babel', 'erasaur:meteor-lodash']);
  api.use('meteorhacks:async', 'server');

  api.export('Galil', both);
  api.addFiles('lib/common.es6.js', both);
  api.addFiles(['lib/parser.es6.js', 'lib/server.es6.js', 'lib/connection.es6.js'], 'server');
  api.addFiles('lib/client.es6.js', 'client');

  api.addFiles('lib/wrappers/array.es6.js', both);
});

Package.onTest(function(api) {
  var both = ['client', 'server'];
  api.use(['tinytest', 'grigio:babel']);
  api.use('rtaic:galil');

  api.addFiles('test/client.es6', 'client');
  api.addFiles('test/server.es6', 'server');
});

Npm.depends({
  'bluebird': '2.9.34'
});
