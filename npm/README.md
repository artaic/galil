# Galil

Allows usage of a galil device.

### Usage

Create a new Galil device like so.

```
import Galil from 'node-galil';

const myGalil = new Galil({
  port: 23,
  host: '192.168.1.3'
});
myGalil.connect();

export myGalil;
```

### Events

This class extends event emitter and therefore emits events

- **'connect'**

When both sockets are connected.

- **'close'**

When either socket has been disconnected. Passes the parameter of the
socket that was closed, and if there is an error.

### API

- `send`

Send a command.
returns a new Promise.
