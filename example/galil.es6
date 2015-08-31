if (Meteor.isServer) {
  Meteor.publish('galil', function() {
    return Galil.connections.find();
  });
} else {
  var sub;
  let index = 0;
  let presses = 0;
  CommandHistory = new Mongo.Collection(null);

  Template.console.helpers({
    socketMessages: function(name) {
      if (sub.ready()) {
        return Galil.connections.findOne({
          name: name
        }).messages;
      }
    },
    socketConnected: function (name) {
      if (sub.ready()) {
        return Galil.connections.findOne({ name: name }).status === 'connected';
      }
    },
  });

  Template.console.onCreated(function() {
    sub = Meteor.subscribe('galil');
  });

  Template.console.events({
    'keyup input': function (e, template) {
      e.preventDefault();
      let history = CommandHistory.find({}, {
        sort: { index: 1 }
      }).map((doc) => doc.command);

      if (e.keyCode === 38) {
        $(e.target).val(history[presses]);
        console.log(presses);
        presses = presses < history.length - 1 ? presses + 1 : history.length;
      } else if (e.keyCode === 40) {
        $(e.target).val(history[presses]);
        presses = presses > 0 ? presses - 1 : 0;
      }
    },
    'blur input': function (e, template) {
      presses = 0;
    },
    'submit form#command-form': function(e, template) {
      e.preventDefault();
      let input = $(e.target).find('input');
      CommandHistory.insert({ command: input.val(), index: index++ });
      Meteor.call('Galil.sendCommand', input.val(), function() {
        input.val('');
      });
    }
  });
}
