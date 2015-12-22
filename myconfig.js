exports.myconfig = {
  "executable": "./production.js",
  "queuePath": "./queue",
  "IoTConfig": {
    "host": "A6R7AFY5KV5WL.iot.us-west-2.amazonaws.com",
    "port": 8883,
	  "clientId": "vehicle900",
	  "thingName": "vehicle900",
	  "caCert": "./root-CA.crt",
	  "clientCert": "./b853ff8dd6-certificate.pem.crt",
	  "privateKey": "./b853ff8dd6-private.pem.key"
  },
  "myIP": "127.0.0.1",
  "GPSudpPort": 5067,
  "shadow": {
    "state": {
      "reported": {
        "VehicleNumber": "900"
      }
    }
  }
};
