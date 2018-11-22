# SAP Cloud Foundry destination handler

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
~~~
const callDestination = require('sap-cf-destination');

callDestination({
        url: '/api/json',
        connectivity_instance: 'connectivity-lite',
        uaa_instance: 'uaa-lite',
        destination_instance: 'destination-lite',
        destination_name: 'tbaas'
    })
        .then(response => {
            // do sth clever from the response
            // of $server_behind_destination_'tbaas'/api/json
        })
        .catch(err => {
            // oh no 💩
        })
~~~



## License
Apache License 2.0

## References
- code inspiration from https://github.com/bertdeterd/scc-connector
- ported `Java` reference code from https://help.sap.com/viewer/cca91383641e40ffbe03bdc78f00f681/Cloud/en-US/313b215066a8400db461b311e01bd99b.html
