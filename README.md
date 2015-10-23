# Galil Controller

Galil is a manufacturer of [motion control solutions](http://www.galilmc.com/motion-controllers).

This package uses sockets to communicate with the controller over an Ethernet
connection and has been tested on several DMC 41x3 "Econo" motion controllers
but may also work with other models.

![Galil](http://www.galil.com/sites/default/files/products/dmc-41x3_big_0.png)

This software, while highly functional, is being provided under an MIT open
source license, and thus is provided as-is without warranty of any kind.

## Usage

### Connection

#### Starting initial connection

`Galil.Devices` is a collection that refers to all known Galil devices.
Only one can have the property `primary` set to `true`, which will be
used for connection.

You can manually insert into `Galil.Devices`, or startup using settings.
That is:

```
meteor --settings ../settings/development.json
```

It is required to have the following keys to create an initial
collection:

```
{
  "galil": {
    "connection": {
      "port": 23,
      "host": "192.168.1.4"
    }
  }
}
```

To connect once you have a Device, use `Galil.connect()`. It is
advisable to do this on a `Meteor.startup` callback.

```
Meteor.startup(function () {
  Galil.connect();
});
```

#### TCP Sockets

There are two sockets open whenever connected. These sockets are:

- messages

When running subroutines, messages will propogate to this socket.

- commands

Responses from running commands will emit their messages here.

### Sending commands and executing subroutines.

It is fairly straight forward to execute subroutines and send commands.

#### Galil.sendCommand / Galil.sendCommands

This will send a command, wait for a success or failure response, and
then return (using futures). It's usage is:

```
> Galil.sendCommand('MG "Hello"')
Hello
> Galil.sendCommands('MG "Hello"', 'MG "Goodbye"');
Hello
Goodbye
```

#### Galil.execute

You can execute a subroutine and wait for a final message before
returning. Say you have a subroutine like this:

```
#Startup
MG "Beginning startup routine"
WT 5000
MG "Doing the thing"
WT 4000
MG "Startup Complete"
```

You can use `Galil.execute` in order to wait until this final message.

```
Galil.execute(`Startup`, /^Startup Complete$/);
```

#### Set timeouts
Providing a number (in milliseconds) to any of the above commands will
set a timeout before erroring out.

```
// will error because Startup will take 9000 milliseconds
Galil.execute(`Startup`, /^Startup Complete$/, 3000);
```

### Responding to events

If you want to watch for events, you can do it in a few ways. Listen is
the easiest.

```
Meteor.methods({
  'do the thing': function () {
    let future = new Future();
    let observer = Galil.listen(<socket>, <regex>, function (message) {
      // asynchronous actions done here
      future.return();
    });
    future.resolve(() => observer.stop());
    return future.wait();
  }
});
```

