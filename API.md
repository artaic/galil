## Modules
<dl>
<dt><a href="#module_Parsers">Parsers</a> ⇒ <code>Array</code></dt>
<dd><p>Parses a message to something more readable by javascript</p>
</dd>
<dt><a href="#module_Server/Galil">Server/Galil</a> ⇐ <code>EventEmitter</code></dt>
<dd><p>Galil controller for server methods</p>
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
Galil controller for server methods

**Extends:** <code>EventEmitter</code>  
**Author:** Alex Frazer  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | the configuration object |
| config.connection | <code>Object</code> | the connection to the controller |
| config.connection.port | <code>Number</code> | the port to connect to |
| config.connection.host | <code>String</code> | the host to connect to |
| config.timeout | <code>Number</code> | how long to wait on synchronous functions before timing out |

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
