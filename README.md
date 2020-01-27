# SAP CP Cloud Foundry destination handler
[![Build Status](https://travis-ci.com/vobu/sap-cf-destination.svg?branch=master)](https://travis-ci.com/vobu/sap-cf-destination) 
[![npm Package](https://img.shields.io/npm/v/sap-cf-destination.svg)](https://www.npmjs.com/package/scp-cf-destination)

## Install
~~~
npm install --save sap-cf-destination
~~~

## Prerequisites
- `destination` and `destination` instance created
- `connectivity` instance created
- `xsuaa` instance created
- all of the above instances bound to the node app, e.g. via `manifest.yml`:
  ~~~ yaml
  applications:
  - name: my_app
    path: my_app
    memory: 128M
    services:
      - xsuaa-instance
      - connectivity-instance
      - destination-instance
  ~~~  

## Usage
~~~ javascript
const callDestination = require('sap-cf-destination');

// Promise chain
callDestination({
        url: '/api/json',
        connectivity_instance: 'connectivity-lite',
        uaa_instance: 'uaa-lite',
        destination_instance: 'destination-lite',
        destination_name: 'tbaas',
        http_verb: 'POST',
        payload: {
            "me": "here"
        }
    })
        .then(response => {
            // do sth clever from the response
            // of $server_behind_destination_'tbaas'/api/json
        })
        .catch(err => {
            // oh no 💩
        })
        
// async/await? 👏
// add the 'async' keyword to an outer function wrapping 'callDestination'
async function getIt() {
    try {
        const response = await callDestination({...});
        // do sth clever w/ the response
    } catch (err) {
        // oh no 💩
    }
}
~~~

## API
## sap-cf-destination(options) ⇒ <code>Promise.&lt;(any\|never)&gt;</code>

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Map</code> | configuration options for several CF service instances |
| options.url | <code>string</code> | the url to call in the destination, absolute path (including leading slash)                              e.g. /api/v1/json |
| options.connectivity_instance | <code>string</code> | name of the instance of the connectivity service |
| options.uaa_instance | <code>string</code> | name of the instance of the uaa service |
| options.destination_instance | <code>string</code> | name of the instance of the destination service |
| options.destination_name | <code>string</code> | name of the destination to use |
| options.http_verb | <code>&#x27;GET&#x27;</code> \| <code>&#x27;POST&#x27;</code> \| <code>&#x27;PUT&#x27;</code> \| <code>&#x27;PATCH&#x27;</code> \| <code>&#x27;DELETE&#x27;</code> \| <code>&#x27;HEAD&#x27;</code> \| <code>&#x27;OPTIONS&#x27;</code> | HTTP method to use |
| [options.payload] | <code>object</code> | payload for POST, PUT or PATCH |
| [options.formData] | <code>object</code> | mimic a browser for POSTing a form to the destination; implies http verb POST |
| [options.content_type] | <code>string</code> | value for "Content-Type" http header, e.g. "application/json" |
| [options.full_response] | <code>boolean</code> | whether to have the full response (including all headers etc)                                          pass through to the caller (BE -> proxy -> client) |
| [options.tech_error_only] | <code>boolean</code> | get a rejection only if the request failed for technical reasons,                                          so e.g. 404 is considered a valid response |
| [options.binary] | <code>boolean</code> | whether to expect (and deliver) a binary at @param url |
| [options.scc_name] | <code>string</code> | Location ID of the sap cloud connector .  |



## Hints & Limitations
- all major HTTP verbs are supported (`GET`, `POST`, `PUT`,`PATCH`,`HEAD`, `DELETE`,`OPTIONS`) per se  
  **BUT**: if the proxy software decides to not let any of them pass through, the request originating from this module will of course fail
- ~~`POST`,~~ `PUT` and `PATCH` only support a JSON payload.
  The payload itself can be a plain, deeply nested object; it will be stringified automatically
- `POST` now supports both a JSON payload and a form-style ("like a browser") submission:
  ~~~js
  callDestination({
    url: ...,
    http_verb: 'POST',
    formData: {
      field1: "some value",
      field2: JSON.stringify([ { "el1": "v1", "el2": "v2" } ])  // stringify deep nested objects and array structures
    }
  })
  ~~~   
- use `scc_name: '<locID>'` as a parameter to specify location ID of the sap cloud connector . By default sap cloud connector with blank location id is used .  
  ~~~js
  callDestination({
          //...
          scc_name: '<locID of SCC>'
      }).then(...).catch(...);
  ~~~
- use `full_response: true` as a parameter to obtain the full response payload, e.g. to get access to response headers  
  ~~~js
  callDestination({
          //...
          full_response: true
      }).then(...).catch(...);
  ~~~
- use `tech_error_only: true` as a parameter to only get a rejection if the request failed for technial reasons ("as long as [it has a status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418), it's a valid response")  
  ~~~js
  callDestination({
          //...
          tech_error_only: true
      }).then( response => {
          // even ☕️ ends up here
          // add
          //    full_response: true (see above)
          // to get response.statusCode
      }).catch( err => {
          // network layer problem or such
      });
  ~~~
- do a download of a binary file by specifying the matching `Content-Type` of the file and setting `binary` to `true`;   
  this will deliver a `Buffer` useable in `writeStreams`
  ~~~js
  callDestination({
          //...
          content_type: 'application/zip',
          binary: true
      }).then( buffer => {
          // write Buffer
          fs.createWriteStream('file.zip')
            .write(buffer, 'binary')
            .end();
          // don't forget to listen to the error and finish event
          // ...
      }).catch(...);
   ~~~


## License
Apache License 2.0

## References
- code inspiration from https://github.com/bertdeterd/scc-connector
- ported `Java` reference code from https://help.sap.com/viewer/cca91383641e40ffbe03bdc78f00f681/Cloud/en-US/313b215066a8400db461b311e01bd99b.html
