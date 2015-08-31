if (Meteor.isServer) {
  Meteor.startup(function() {
  });

  Meteor.publish('galil_messages', function() {
    return Galil.collection.find({}, {
      sort: {
        timestamp: 1
      }
    });
  });

  Meteor.publish('galil_connection', function () {
    return Galil.connections.find();
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
    },
    galilDisconnected: function () {
      return !_.all(Galil.connections.find().map((doc) => {
        return doc.status === 'connected';
      }));
    }
  });

  Template.console.onCreated(function() {
    Meteor.subscribe('galil_messages');
    Meteor.subscribe('galil_connection');
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
