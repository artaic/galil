if (Meteor.isServer) {
  Galil.Connections.allow({
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
      return Galil.Connections.findOne({
        name: name
      });
    }
  });

  Template.subroutines.events({
    'click button[data-action="startup"]': function (e, template) {
      $(e.target).attr('disabled', true);
      Meteor.call('test startup', function (err, result) {
        $(e.target).attr('disabled', false);
      });
    }
  });

  Template.console.events({
    'keyup': function (e, template) {
      let input = template.find('input');
      const i = Session.get('commandIndex');
      if (e.keyCode === 38 || e.keyCode === 40) {
        if (e.keyCode === 38 && i - 1 > 0) {
          Session.set('commandIndex', i - 1);
        }
        if (e.keyCode === 40 && i + 1 < Galil.History.find().count() - 1) {
          Session.set('commandIndex', i + 1);
        }
        let history = Galil.History.findOne({
          index: Session.get('commandIndex')
        }) || { command: '' };
        $(input).val(history.command);
      }
    },

    'submit form#command-form': function(e, template) {
      e.preventDefault();
      let input = $(e.target).find('input');
      Meteor.call('send command', input.val(), (err) => {
        input.val('');
      });
    }
  });

  Template.body.onRendered(function () {
    Session.setDefault('commandIndex', Galil.History.find().count() - 1);
  });
}
