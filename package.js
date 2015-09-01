Package.describe({
  name: 'rtaic:galil',
  version: '0.0.4',
  summary: 'Interact with the Galil controller',
  git: 'https://github.com/artaic/Galil',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  var both = ['client', 'server'];

  api.use(['mongo', 'check', 'grigio:babel@0.1.7', 'erasaur:meteor-lodash@3.10.1']);
  api.use('meteorhacks:async@1.0.0', 'server');

  api.export('Galil', both);

  api.addFiles('lib/common.es6.js', both);
  api.addFiles([
    'lib/parser.es6.js',
    'lib/server.es6.js',
    'lib/wrappers/array.es6.js'
  ], 'server');
  api.addFiles('lib/client.es6.js', both);

});

Package.onTest(function(api) {
  var both = ['client', 'server'];
  api.use(['practicalmeteor:munit', 'grigio:babel', 'erasaur:meteor-lodash']);
  api.use('rtaic:galil');

  api.addFiles(['test/init.es6', 'test/connection.es6']);
});

