# Galil Controller

This component is attached to the robot for controlling its motion. It
looks like this.

<img
src="http://www.galil.com/sites/default/files/products/dmc-41x3_big_0.png" alt="Galil" />

However, this component requires a special setup to test and use.

### First time setup of Galil controller

1. Connect the power supply to the galil controller. You should expect
   to see the `POWER` under the ethernet adapter light turn on.
2. Plug in the ethernet cable to your computer from the controller. You
   should expect to see the `LINK/ACT` green light turn on.
3. Download
   [GalilTools](http://www.galilmc.com/downloads/software/galiltools)
4. Click the blue plus in the top menu, select your connection, and
   connect.
5. For an initial test, in the right sidebar called "Terminal", type
   `MG"Test message"`. It should output `Test message`.
6. Go to the `resources/` folder at the git root and copy the contents
   of `test.dmc`, click the new program icon in the top menu, and pase this code.
7. Click the "Download" button to download this code to the robot.
8. Attempt to run a command by using `XQ #Auto`. You should see some
   response go to the terminal.

### Connecting meteor application.

Start up your meteor server and your meteor shell. In your meteor shell,
`Galil` should be defined.

```
> Galil
[Function Galil]
> var galil = new Galil("<yourhost>", "<yourport>");
> galil.status
"connected"
```

This opens two connections: `commands` and `messages`. Messages will be
relayed on "messages".

You can now execute commands via the `execute`.

```
> galil.commands.execute('XQ#Auto');
>
```

Check your Meteor console. You should see something like as follows

```
MESSAGES => 150701 Test Program
```

### Testing
In this directory, use `meteor test-packages ./` and go to
`localhost:3000` on your browser
