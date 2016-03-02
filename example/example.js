if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.hello.helpers({
    counter: function () {
      return Session.get('counter');
    }
  });

  Template.hello.events({
    'click button': function () {
      // increment the counter when button is clicked
      Session.set('counter', Session.get('counter') + 1);
    }
  });
}

if (Meteor.isServer) {
  galil = new Galil({
    port: 23,
    host: '169.254.248.225'
  });

  Meteor.startup(function () {
    galil.connect().then(() => {
      console.log('Connected.');
    });
  });
}
