if (Meteor.isServer) {
  galil = new Galil({
    port: 23,
    host: '169.254.248.225'
  }).connect();
} else if (Meteor.isClient) {
  Session.setDefault('time', 1000);
  Template.Layout.events({
    'click button': function () {
      Meteor.call('fail', Session.get('time'), function (err, res) {
        if (err) {
          console.warn("Error has occured");
          console.warn(err.message);
        } else {
          console.log('No problem');
        }
      })
    }
  });
}
