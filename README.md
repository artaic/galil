# Galil Controller

### Setting up.

Run your meteor applications with settings. The following keys are
required to run it.

```
{
  "galil": {
    "connection": {
      "host": "192.168.1.3",
      "port": 23,
    },
    "defaultTimeout": 10000
  }
}
```

- 'galil.connection.host' must be of type `String`
- 'galil.connection.port' must be of type `Number`
- 'galil.defaultTimeout' must be of type `Number`

You can change these with a setter.

```
> Galil.config.connection = { port: 25 };
{
  "galil": {
    "connection": {
      "host": "192.168.1.3",
      "port": 25,
    }
  }
}
```

### Reading messages from the controller

The Galil controller exports with a collection `Galil.collection`. This
will be written to whenever a message is received and has the following
format.

{
  "socket": "messages",
  "message": "Some data",
  "timestamp": new Date,
  "type": ""
}

- Socket is the socket that received this message. It could be either
  `messages` or `commands`.

- Message is the _parsed_ data received from the data event.

- timestamp is the time that it was added to the collection

- Type is the type of message it was. If you deliminate your messages on
  something, it will be the 0th index.

### Responding to events

On the server, `Galil` extends EventEmitter. That means you can emit and
respond to your own custom events.

```
Galil._messages.addListener('connect', () =>
this.emit('messages_connected'));

Galil.on('messages_connected', () => {
  console.log('The message socket is now connected!');
});
```

### Synchronous Execution

`Galil.execute` will send an execute command and wait for a message
saying the event is done. You can configure the end message by setting
the configuration variable of `routine_end`.

```
Galil.config.parser.routine_end = 'End';
```

You can also set a `defaultTimeout`. If no data is received for this
period of time, throw an error.

```
Galil.config.defaultTimeout = 60 * 1000;  // one minute without data
throws an error
```

To run a synchronous execution, pass the subroutine you wish to execute.

```
// Usage on the client
Galil.execute('Startup', 60, function () {
  console.log('Finished setup!')
});

// Usage on the server
Galil.execute('Startup', 60);
```

