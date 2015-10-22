# Galil Controller

Galil is a manufacturer of [motion control solutions](http://www.galilmc.com/motion-controllers). 

This package uses sockets to communicate with the controller over an Ethernet 
connection and has been tested on several DMC 41x3 "Econo" motion controllers 
but may also work with other models.

![Galil](http://www.galil.com/sites/default/files/products/dmc-41x3_big_0.png)

This software, while highly functional, is being provided under an MIT open 
source license, and thus is provided as-is without warranty of any kind.

### Setting Up

There are two required environment variables:

- **GALIL\_HOST** the host to connect to
- **GALIL\_PORT** the port to use.

### Configuration

In order to use synchronous execution, you must have a token that will
denote the start and end of a subroutine.

```
test.dmc

#mySub
MG "Start:mySub"
WT 5000
MG "Waited five seconds."
MG "End:mySub"
```

In this example, we've provided some additional messages at the beginning and
end of the subroutine to help the package signal when the subroutine has
completed, as it is otherwise an asynchronous operation.

To execute this subroutine using GalilTools, you'd use the XQ firmware command:

```
XQ #mySub
```

### Reactive data sources

There are a couple of reactive data sources on the client.

- Galil.status();

This is very similar to
[Meteor.status()](https://devdocs.io/meteor/index#meteor_status), but
without retryCount. It will return the current status of the Galil controller's connection.
Returns `connected` if all established connections are available.
`status` has the same values as `Meteor.status().status`.

- Galil.executing()

Returns true if a subroutine is currently in execution. Example usage:

```
// disable if executing.
button(data-action="startup" disabled="{{Galil.executing}}")
```

- Galil.lastMessage()

Returns the last message emitted by each connection.

### Responding to errors

Right now, the methods to respond to errors is fairly anemic, but here
is some basics:

#### Connection errors
You can scan `Galil.status()` in order to handle the errors in the
connection. For example:

```
if (Galil.status().status === 'disconnected') {
  notify('Galil is disconnected!', { type: 'error' })
}
```

#### Command errors

When a command fails, you will find a `?` a your last message. Here is a
way to respond to it:

```
if (_.last(Galil.lastMessage()) === '?') {
  notify('Command failed with status ?');
}
```

### Interacting with the Controller

The Galil package exports with a collection `Galil.collection`. This
will be written to whenever a message is received and has the following
format.

{
  "socket": "messages",
  "message": "mySub:Start",
  "timestamp": new Date(),
  "type": "mySub"
}

- `socket` is the socket that received this message. It could be either
  `messages` or `commands`.
- `message` is the _parsed_ data received from the data event.
- `timestamp` is the time that it was added to the collection.
- `type` is the type of message it was. If you delimit your messages with
  something, it will be the 0th index.  

### Responding to Events

On the server, `Galil` extends EventEmitter. That means you can emit and
respond to your own custom events:

```
Galil._messages.addListener('connect', () =>
this.emit('messages_connected'));

Galil.on('messages_connected', () => {
  console.log('The message socket is now connected!');
});
```

### Adding hooks

If you want to scan for a message, you can use `Galil.registerEvent` and
`Galil.unregisterEvent`. The parameters are:

- the regex to scan for
- the handler function to make use of

The handler function will apply the result of `exec` to the function.

Example usage is like so:

```
Galil.registerEvent(/^(Arm|Fork):(Ready|Failed)$/, function (component, state) {
  Components.update({
    name: component
  }, {
    $set: { state: state }
  });
});
```

### Synchronous Execution

`Galil.execute` will send an execute command and wait for a message saying the 
event is done. You can configure the end message by setting the configuration 
variable of `routine_end`.

```
Galil.config.parser.routine_end = 'End';
```

You can also set a default timeout. If no data is received during this
period of time, an error will be thrown.

```
Galil.config.defaultTimeout = 60 * 1000;  // one minute without data
throws an error
```

To execute a subroutine synchronously, pass the subroutine name you wish 
to execute:

```
// Usage on the client
Galil.execute('mySub', 60 * 1000, function () {
  console.log('Finished subroutine!')
});

// Usage on the server
Galil.execute('mySub', 60 * 1000);
```

### FAQ

- How do I check if the Galil is connected?

_current implementation: using mongo collections_

`Galil` has a bound collection called "connections". This should update
its status when its state changes. You can check this on the server.

```
// will return `true` if all the connections are ready.
let connections = _.all(Galil.connections.find().map((doc) => {
  return doc.status === 'connected';
}));
```

This is live, so you can publish it to the client and it will update the
connection if connection is ever lost. The following could be used to
show connection status.

```
if (Meteor.isServer) {
  Meteor.publish('galil_connection', function () {
    return Galil.connections.find();
  });
} else {
  Template.galil.onCreated(function () {
    Meteor.subscribe('galil_connection');
  });

  Template.galil.helpers({
    galilDisconnected: function () {
      return _.all(Galil.connections.find().map((doc) => {
        return doc.status === 'connected';
      }));
    }
  });
}
```

On your template, you can use these helpers fairly easily.

```
<input type="text" placeholder="enter command" disabled="{{
galilDisconnected }}">
```

### TO DO

- implement the ability to configure multiple galil controllers
- find all galil controllers via device discovery on the network
- create an interface for changing the current galil controller or
  controller configuration.
