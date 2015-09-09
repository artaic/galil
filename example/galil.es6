if (Meteor.isServer) {
  Meteor.publish('galil_connection', function(name) {
    return Galil.connections.find({ name: name });
  });

  Galil.connections.allow({
    update: function () {
      return true;
    }
  });
} else {
  Template.socket.helpers({
    socket: function (name) {
      let sub = Meteor.subscribe('galil_connection', name);
      if (sub.ready()) {
        let conn = Galil.connections.findOne({
          name: name
        });
        conn.messages.map((m) => {
          m.message.replace(Galil.config.parser.linesep, '<br/>');
        });
        return conn;
      }
    }
  });

  Template.console.events({
    'submit form#command-form': function(e, template) {
      e.preventDefault();
      let input = $(e.target).find('input');
      Meteor.call('Galil.sendCommand', input.val(), function() {
        input.val('');
      });
    }
  });
}
