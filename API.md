## Modules
<dl>
<dt><a href="#module_Parsers">Parsers</a> ⇒ <code>Array</code></dt>
<dd><p>Parses a message to something more readable by javascript</p>
</dd>
<dt><a href="#module_Server/Galil">Server/Galil</a> ⇐ <code>EventEmitter</code></dt>
<dd><p>Galil controller server methods</p>
</dd>
</dl>
## Functions
<dl>
<dt><a href="#list">list()</a></dt>
<dd><p>Lists all of the allocated arrays on the controller</p>
</dd>
<dt><a href="#download">download(arrayName, DMArray)</a></dt>
<dd><p>Download an array to the controller</p>
</dd>
<dt><a href="#upload">upload(arrayName)</a></dt>
<dd><p>Upload (read) a series of array values</p>
</dd>
<dt><a href="#listPrograms">listPrograms()</a></dt>
<dd><p>writes a list of all programs installed on the controller</p>
</dd>
</dl>
<a name="module_Parsers"></a>
## Parsers ⇒ <code>Array</code>
Parses a message to something more readable by javascript

**Returns**: <code>Array</code> - an array of parsed messages  
**Example**  
```js
Galil._messages.on('data', (data) => {
  console.log(this.parse(data));
});

['Start', 'Unload']
```
<a name="module_Server/Galil"></a>
## Server/Galil ⇐ <code>EventEmitter</code>
Galil controller server methods

**Extends:** <code>EventEmitter</code>  

* [Server/Galil](#module_Server/Galil) ⇐ <code>EventEmitter</code>
  * [~execute(command)](#module_Server/Galil..execute) ⇒ <code>String</code>
  * [~sendCommand(command)](#module_Server/Galil..sendCommand) ⇒ <code>Promise</code>
  * [~sendCommands()](#module_Server/Galil..sendCommands)

<a name="module_Server/Galil..execute"></a>
### Server/Galil~execute(command) ⇒ <code>String</code>
Execute a command on the galil controller
This will lock in execution synchronously with a fiber.

**Kind**: inner method of <code>[Server/Galil](#module_Server/Galil)</code>  
**Returns**: <code>String</code> - the name of the routine completed.  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | the command to execute |

**Example**  
```js
> Galil.execute('Load');
```
<a name="module_Server/Galil..sendCommand"></a>
### Server/Galil~sendCommand(command) ⇒ <code>Promise</code>
Sends command to the Galil controller from the server

**Kind**: inner method of <code>[Server/Galil](#module_Server/Galil)</code>  
**Returns**: <code>Promise</code> - a promisified response  
**Throws**:

- MatchError if not provided an array or string


| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> &#124; <code>Array</code> | the command to execute |

**Example**  
```js
// sending a single command
> Galil.sendCommand('MG "Hello, world!"');
> Galil.collection.find().fetch()
[{
 socket: 'commands',
 message: 'Hello, world!',
 timestamp: sometime
}]

// send a series of commands in sequence
> Galil.sendCommand(['MG "Hello, "', 'MG "World!"']);
> Galil.collection.find().fetch()
[{
 socket: 'commands',
 message: 'Hello, world!',
 timestamp: ISODate()
}, {
 socket: 'commands',
 message: 'Hello, ',
 timestamp: ISODate()
}, {
 socket: 'commands',
 message: 'World!',
 timestamp: ISODate()
}]
```
<a name="module_Server/Galil..sendCommands"></a>
### Server/Galil~sendCommands()
Send a variety of commands as an array

**Kind**: inner method of <code>[Server/Galil](#module_Server/Galil)</code>  
<a name="list"></a>
## list()
Lists all of the allocated arrays on the controller

**Kind**: global function  
<a name="download"></a>
## download(arrayName, DMArray)
Download an array to the controller

**Kind**: global function  
**Throws**:

- Match.Error if the type check fails.


| Param | Type | Description |
| --- | --- | --- |
| arrayName | <code>String</code> | the name of the array to update |
| DMArray | <code>Array</code> | what to set the values to |

<a name="upload"></a>
## upload(arrayName)
Upload (read) a series of array values

**Kind**: global function  
**Throws**:

- Match.Error if the array name is not a string


| Param | Type | Description |
| --- | --- | --- |
| arrayName | <code>String</code> | the name of the array to upload |

<a name="listPrograms"></a>
## listPrograms()
writes a list of all programs installed on the controller

**Kind**: global function  
