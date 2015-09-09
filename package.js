Package.describe({
  name: 'insightfil:galil',
  version: '0.0.8',
  summary: 'Interact with the Galil controller',
  git: 'https://github.com/artaic/Galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.3');
  var both = ['client', 'server'];

  api.use(['mongo', 'check', 'tracker', 'grigio:babel@0.1.7', 'erasaur:meteor-lodash@3.10.1']);
  api.use('meteorhacks:async@1.0.0', 'server');

  api.export('Galil', both);

  api.addFiles(['lib/common.es6', 'lib/parser.es6'], both);
  api.addFiles([
    'lib/server.es6',
    'lib/wrappers/array.es6'
  ], 'server');
  api.addFiles('lib/client.es6', both);

});

Package.onTest(function(api) {
  var both = ['client', 'server'];
  api.use(['practicalmeteor:munit', 'grigio:babel', 'erasaur:meteor-lodash']);
  api.use('insightfil:galil');

  api.addFiles(['test/init.es6', 'test/connection.es6']);
});

