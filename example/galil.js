if (Meteor.isServer) {
  Meteor.startup(function () {
    Galil.connect(23, '169.254.248.255');
  });

  Galil.connections.allow({
    update: function () {
      return true;
    }
  });

  Meteor.methods({
    'test startup': function () {
      return Galil.execute('Startup', /End:Startup/);
    },
    'send command': function (command) {
      check(command, String);
      return Galil.sendCommand(command);
    }
  });
} else {
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
      Meteor.call('test startup', function (err, result) {
        console.log(err);
        console.log(result);
        $(e.target).attr('disabled', false);
      });
    }
  });

  Template.console.events({
    'submit form#command-form': function(e, template) {
      e.preventDefault();
      let input = $(e.target).find('input');
      Meteor.call('send command', input.val(), () => input.val(''));
    }
  });
}
