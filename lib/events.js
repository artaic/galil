const XRegExp = Npm.require('xregexp');

// to do: make this a collection?
Galil.Events = [];

/**
 * Registers an event on the controller.
 * When a matching regex is received, it will attempt to run a given callback function.
 * Returns the function so that it can be unregistered.
 */
Galil.registerEvent = function (event, handler, options={}) {
  check(event, Match.OneOf(String, RegExp));
  check(handler, Function);
  check(options, Object);

  const expression = new XRegExp(event);

  console.log(expression);
  _.defaults(options, { socket: 'messages' });

  Galil.Events.push(_.extend(options, {
    event: expression,
    handler: handler
  }));

  return handler;
}

Galil.unregisterEvent = function (event, handler) {
  const result = _.indexOf(Galil.Events, function (doc) {
    doc.handler === handler && doc.event === event;
  });

  if (result !== -1) {
    Galil.Events.slice(result, 1);
  }
}

Galil.Connections.find().observe({
  added: function () {
  },
  changed: function (doc) {
    doc.tail.forEach(function (m) {
      const result = _.find(Galil.Events, e => e.event.test(m.message));
      if (result) {
        let args = XRegExp.exec(m.message, result.event);
        result.handler.apply(Galil, args);
      }
    });
  }
});

