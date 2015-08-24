Package.describe({
  name: 'afrazer:galil',
  version: '0.0.1',
  summary: 'Interact with the Galil controller',
  git: 'https://github.com/AlexFrazer/Galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  var both = ['client', 'server'];

  api.use(['check', 'mongo', 'grigio:babel', 'erasaur:meteor-lodash', 'service-configuration'], both);

  api.export('Galil', both);
  api.export('GalilMessages', both);

  api.addFiles('lib/common.es6', both);
  api.addFiles('lib/server.es6', 'server');
  api.addFiles('lib/client.es6', 'client');
});

Package.onTest(function(api) {
  api.use(['tinytest', 'grigio:babel', 'service-configuration']);
  api.use('afrazer:galil');

  api.addFiles('test/client.es6', 'client');
  api.addFiles('test/server.es6', 'server');
});

Npm.depends({
  'bluebird': '2.9.34'
});
