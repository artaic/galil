# Galil Controller

[![Build Status](https://travis-ci.org/artaic/galil.svg?branch=master)](https://travis-ci.org/artaic/galil)

Galil is a manufacturer of [motion control solutions](http://www.galilmc.com/motion-controllers).

This package uses sockets to communicate with the controller over an Ethernet
connection and has been tested on several DMC 41x3 "Econo" motion controllers
but may also work with other models.

![Galil](http://www.galil.com/sites/default/files/products/dmc-41x3_big_0.png)

This software, while highly functional, is being provided under an MIT open
source license, and thus is provided as-is without warranty of any kind.

# API

## Connection

```
Galil.connect(Number port, String host)
```

Attempts to connect. Takes the same parameters as a plain
`net.Socket.connect` from node.

Will attempt to reconnect up to five times. When the max retries is
exceeded, it will write an error and fail silently.

```
Galil.reconnect()
```

Resets the `retryCount` for every socket and then attempts to connect
with the last used address.

```
Galil.disconnect()
```
Closes the connection.

## Commands

```
Galil.sendCommand(String command, [timeout=60000]);
```

Sends a command on the galil socket and waits for a `:` response on the
socket (suggesting that it has been successfully sent).

```
Galil.execute(String command, RegExp end [, timeout=60000])
```
Execute a subroutine and wait to receive a message.
