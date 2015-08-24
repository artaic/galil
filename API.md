## Modules
<dl>
<dt><a href="#module_Galil">Galil</a> ⇐ <code>EventEmitter</code></dt>
<dd><p>Galil controller server methods</p>
</dd>
</dl>
## Functions
<dl>
<dt><a href="#sendCommand">sendCommand(command)</a> ⇒ <code>Promise</code></dt>
<dd><p>Sends a command to the controller from the client</p>
</dd>
</dl>
<a name="module_Galil"></a>
## Galil ⇐ <code>EventEmitter</code>
Galil controller server methods

**Extends:** <code>EventEmitter</code>  

* [Galil](#module_Galil) ⇐ <code>EventEmitter</code>
  * [~execute(command)](#module_Galil..execute)
  * [~sendCommand(command)](#module_Galil..sendCommand) ⇒ <code>Promise</code>
  * [~sendCommand(command)](#module_Galil..sendCommand) ⇒ <code>Promise</code>

<a name="module_Galil..execute"></a>
### Galil~execute(command)
Execute a command on the galil controller
TO DO: Wait on the response as "END:[routine]" to return

**Kind**: inner method of <code>[Galil](#module_Galil)</code>  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | the command to execute |

**Example**  
```js
> Galil.execute('Load');
```
<a name="module_Galil..sendCommand"></a>
### Galil~sendCommand(command) ⇒ <code>Promise</code>
Sends command to the Galil controller from the server

**Kind**: inner method of <code>[Galil](#module_Galil)</code>  
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
> GalilMessages.find().fetch()
[{
 socket: 'commands',
 message: 'Hello, world!',
 timestamp: sometime
}]

// send a series of commands in sequence
> Galil.sendCommand(['MG "Hello, "', 'MG "World!"']);
> GalilMessages.find().fetch()
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
<a name="module_Galil..sendCommand"></a>
### Galil~sendCommand(command) ⇒ <code>Promise</code>
Alias for `Galil.sendCommand`

**Kind**: inner method of <code>[Galil](#module_Galil)</code>  
**Returns**: <code>Promise</code> - a promisified response  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | the command to execute |

**Example**  
```js
> Galil.execute('Load');
```
<a name="sendCommand"></a>
## sendCommand(command) ⇒ <code>Promise</code>
Sends a command to the controller from the client

**Kind**: global function  
**Returns**: <code>Promise</code> - a promise containing the result.  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> &#124; <code>Array</code> | the command to send to the controller |

**Example**  
```js
> Galil.sendCommand('MG "Hello World!"').then(function () {
   console.log('Sent command!');
});
```
