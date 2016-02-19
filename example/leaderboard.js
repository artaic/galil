if (Meteor.isServer) {
  galil = new Galil();

  galil.onConnect(function () {
    console.log('Connected!');
  });
  galil.connect(23, "169.254.248.225");

  Meteor.methods({
    'fail': function (timeToWait) {
      check(timeToWait, Number);
      galil.execute('cat', /^I waited 5 seconds$/, timeToWait);
    }
  });
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
