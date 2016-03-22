Package.describe({
  name: 'insightfil:galil',
  version: '1.4.0',
  summary: '',
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3-beta.12');
  api.use(['ecmascript', 'mongo', 'promise']);

  api.mainModule('server.js', 'server');
  api.mainModule('client.js', 'client');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('testing');
  api.mainModule('testing-tests.js');
});

Npm.depends({
  'meteor-node-stubs': '0.2.0'
});
