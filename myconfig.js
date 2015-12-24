module.exports.myconfig = {
  "executable": "/home/pi/nodeOnPiOnABus/production.js",
  "queuePath": "/home/pi/nodeOnPiOnABus/queue",
  "IoTConfig": {
    "host": "A6R7AFY5KV5WL.iot.us-west-2.amazonaws.com",
    "port": 8883,
    "reconnectPeriod":10000,
	  "clientId": "vehicle900",
	  "thingName": "vehicle900",
	  "caCert": "/home/pi/nodeOnPiOnABus/root-CA.crt",
	  "clientCert": "/home/pi/nodeOnPiOnABus/b853ff8dd6-certificate.pem.crt",
	  "privateKey": "/home/pi/nodeOnPiOnABus/b853ff8dd6-private.pem.key"
  },
  "myIP": "192.168.1.15",
  "GPSudpPort": 5067,
  "shadow": {
    "state": {
      "reported": {
        "VehicleNumber": "900"
      }
    }
  }
};
