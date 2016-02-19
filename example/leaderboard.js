if (Meteor.isServer) {
  galil = new Galil();

  galil.onConnect(function () {
    console.log('Connected!');
  });
  galil.connect(23, "169.254.248.225");

  Meteor.methods({
    'fail': function (timeToWait) {
      check(timeToWait, Number);

      let chain = function () {
        let listenForError;

        galil.sendCommand('XQ#Startup').then(() => {
        });
        return new Promise((resolve, reject) => {
          listenForError = Meteor.bindEnvironment(data => {
            if (/^ERROR$/.test(data)) {
              reject(new Meteor.Error(400, "That slot is full"));
            }
          });

          galil.on('message', listenForError);
          galil.execute('Startup', /^End:Startup$/).then(resolve).catch(reject);
        }).then(() => {
          return galil.execute('fail', /^I waited 5 seconds$/);
        }).finally(() => {
          galil.removeListener('message', listenForError);
        });
      }

      return Promise.await(chain());
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
