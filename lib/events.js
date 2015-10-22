const XRegExp = Npm.require('xregexp');

Galil.Events = new Mongo.Collection('galil_events', {
  transform: function (x) {
    let cls = _.extend({}, x);
    cls.regex = new XRegExp(x.event);
    cls.fn = new Function(`return ${x.handler}`)();
    return cls;
  }
});

/**
 * Registers an event on the controller.
 * When a matching regex is received, it will attempt to run a given callback function.
 * Returns the function so that it can be unregistered.
 */
Galil.registerEvent = function (event, handler, options={}) {
  check(event, Match.OneOf(String, RegExp));
  check(handler, Function);
  check(options, Object);

  _.defaults(options, { socket: 'messages' });

  Galil.Events.upsert({
    event: event,
    handler: handler.toString()
  }, {
    $set: {
      event: event,
      handler: handler.toString()
    }
  });

  return handler;
}

Galil.unregisterEvent = function (event, handler) {
  return Galil.Events.update({
    event: event,
    handler: handler.toString()
  });
}

Galil._messages.addListener('data', Meteor.bindEnvironment(function (data) {
  const parsed = data.toString('ascii').replace(/\n/, '').split(/\r/);
  parsed.forEach(function (message) {
    Galil.Events.find().forEach(function (doc) {
      if (doc.regex.test(message)) {
        doc.fn.apply(Galil, doc.regex.exec(message));
      }
    });
  });
}));

