# Galil Controller

[![Build Status](https://travis-ci.org/artaic/galil.svg?branch=master)](https://travis-ci.org/artaic/galil)

Galil is a manufacturer of [motion control solutions](http://www.galilmc.com/motion-controllers).

This package uses sockets to communicate with the controller over an Ethernet
connection and has been tested on several DMC 41x3 "Econo" motion controllers
but may also work with other models.

![Galil](http://www.galil.com/sites/default/files/products/dmc-41x3_big_0.png)

This software, while highly functional, is being provided under an MIT open
source license, and thus is provided as-is without warranty of any kind.

### Basic Usage

```
import Galil from 'galil';

const galil = new Galil();

galil.commands.on('data', function (data) {
  console.log(`Received message on commands socket: ${data}`);
});

galil
  .connect(23, process.env.GALIL_HOST)
  .then(() => {
    console.log('Galil is connected!');
    galil.send('MG "Are we good to go, Captain?"')
  });
```
