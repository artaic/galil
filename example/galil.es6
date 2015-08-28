if (Meteor.isServer) {
  Meteor.startup(function() {
    if (!process.env.GALIL_HOST || !process.env.GALIL_PORT) {
      throw new Meteor.Error(`No connection specified\nPlease set GALIL_HOST and GALIL_PORT in environment.`);
    }
  });

  Meteor.publish('galil_messages', function() {
    return Galil.collection.find({}, {
      sort: {
        timestamp: 1
      }
    });
  });
} else {
  Template.console.helpers({
    messages: function() {
      return Galil.collection.find({
        socket: 'messages'
      });
    },
    commands: function() {
      return Galil.collection.find({
        socket: 'commands'
      })
    },
    messageCount: function() {
      return Galil.collection.find({
        socket: 'messages'
      }).count()
    },
    commandCount: function() {
      return Galil.collection.find({
        socket: 'commands'
      }).count();
    }
  });

  Template.console.onCreated(function() {
    let sub = Meteor.subscribe('galil_messages');
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
