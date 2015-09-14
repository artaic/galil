if (Meteor.isServer) {
  Meteor.publish('galil_connection', function(name) {
    return Galil.connections.find({ name: name });
  });

  Galil.connections.allow({
    update: function () {
      return true;
    }
  });

  Meteor.methods({
    'testStartup': function (documentId) {
      check(documentId, String);
      Galil.sendCommand(`MG "Initiating startup"`);
      Galil.sendCommands(`MG_XQ0`);
      Galil.sendCommands([
        `MG "Setting documentId variable to new value: ${documentId}"`,
      ]);
      return Galil.execute('Startup');
    }
  });
} else {
  Template.console.onCreated(function () {
    Session.setDefault('documentId', '1234');
  });

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

  Template.subroutines.events({
    'click button[data-action="startup"]': function (e, template) {
      $(e.target).attr('disabled', true);
      Meteor.call('testStartup', Session.get('documentId'), function () {
        $(e.target).attr('disabled', false);
      });
    }
  });

  Template.console.events({
    'submit form#command-form': function(e, template) {
      e.preventDefault();
      let input = $(e.target).find('input');
      Meteor.call('Galil.sendCommand', input.val(), () => input.val(''));
    }
  });
}
