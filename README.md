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

## Hints & Limitations
- all major HTTP verbs are supported (`GET`, `POST`, `PUT`,`PATCH`,`HEAD`, `DELETE`,`OPTIONS`) per se  
  **BUT**: if the proxy software decides to not let any of them pass through, the request originating from this module will of course fail
- `POST`, `PUT` and `PATCH` only support a JSON payload.
  The payload itself can be a plain, deeply nested object; it will be stringified automatically
- use `full_response: true` as a parameter to obtain the full response payload, e.g. to get access to response headers  
  ~~~ javascript
  callDestination({
          //...
          full_response: true
      }).then(...).catch(...);
  ~~~


## License
Apache License 2.0

## References
- code inspiration from https://github.com/bertdeterd/scc-connector
- ported `Java` reference code from https://help.sap.com/viewer/cca91383641e40ffbe03bdc78f00f681/Cloud/en-US/313b215066a8400db461b311e01bd99b.html
