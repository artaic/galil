# Galil Controller

<img
src="http://www.galil.com/sites/default/files/products/dmc-41x3_big_0.png" alt="Galil" />

### Setting up.

To begin, you must insert a configuration into your service
configurations table. The keys required are `host` and `port`, and the
service key must be `galil` (all lower case).

```
ServiceConfiguration.configurations.upsert({ service: 'galil' }, {
  $set: {
    host: '192.168.0.3',
    port: 23
  }
})
```

The package exports a collection called "GalilMessages". You can use
this in your templates pretty easily to see the messages returned by the
Galil controller. Here is an example setup with publications and live
templates.

```
if (Meteor.isServer) {
  Meteor.publish('galil_messages', function () {
    return GalilMessages.find();
  });
}

if (Meteor.isClient) {
  Template.yourTemplate.onCreated(function () {
    Meteor.subscribe('galil_messages');
  });

  Template.yourTemplate.helpers({
    messages: function () {
      return GalilMessages.find();
    },
    formatTime: function (timestamp, formatString) {
      return moment(timestamp).format(formatString);
    }
  });
}
```

Then in your template you can simply use the `each` directive. The
schema keys on GalilMessages are: `message`, `socket`, and `timestamp`.

```
each messages
  div(class="message {{socket}}")
    p
      strong
        | {{ formatTime timestamp 'HH:MM:SS' }} Socket[{{ socket }}] =>
      {{ message }}
```

### Usage of event handlers (server only)
On the server, an event will be fired off when receiving specific
messages. These are colon deliminated. For example, Take a subroutine like so

```
#MotionError
MG "Error:Motion"
```

You can subscribe to this event (on the server) to do something
specific. Eg:

```
Galil.on('Error', function (errorCode) {
  throw new Meteor.Error('GalilError', errorCode);
});
```

