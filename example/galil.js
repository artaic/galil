if (Meteor.isServer) {
  Meteor.startup(function () {
    Galil.connect(23, '169.254.248.255');
  });

  Meteor.publish('galil_connection', function(name) {
    return Galil.connections.find({ name: name });
  });

  Galil.connections.allow({
    update: function () {
      return true;
    }
  });

  Meteor.methods({
    'test startup': function () {
      console.log('Calling startup');
      Galil.sendCommand('MG "Hello"');
      Galil.execute('Startup', /^End:Startup$/);
    }
  });
} else {
  Template.console.onCreated(function () {
    Session.setDefault('documentId', '1234');
  });

  Template.socket.helpers({
    socket: function (name) {
      return Galil.connections.findOne({
        name: name
      });
    }
  });

  Template.subroutines.events({
    'click button[data-action="startup"]': function (e, template) {
      $(e.target).attr('disabled', true);
      Meteor.call('test startup', Session.get('documentId'), function () {
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
