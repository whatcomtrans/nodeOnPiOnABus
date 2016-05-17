module.exports.localconfig = {
  "useAlternateLocalConfigPath": "/home/pi/nodeOnPiOnABus/settings/remote-config.js",
  "configPath": "/home/pi/nodeOnPiOnABus/settings/remote-config.js",
  "fallbackConfigPath": "./localconfig.js",
  "saveConfigToPath": "/home/pi/nodeOnPiOnABus/settings/remote-config.js",
  "saveConfigToPathTemp": "/home/pi/nodeOnPiOnABus/settings/tmp/remote-config-temp.js",
  "configURL": "http://piconfig.fleetnet.whatcomtrans.net/config",
  "runDelay": 1.5 * 60 * 1000,
  "getRemoteDelay": 1 * 60 * 1000
};

module.exports.myconfig = {
  "executable": "./production.js",
  "queuePath": "./queue",
  "IoTConfig": {
    "host": "A6R7AFY5KV5WL.iot.us-west-2.amazonaws.com",
    "port": 8883,
    "reconnectPeriod":1000,
	  "clientId": "vehicle900",
	  "thingName": "vehicle900",
	  "caCert": "root-CA.crt",
	  "clientCert": "b853ff8dd6-certificate.pem.crt",
	  "privateKey": "b853ff8dd6-private.pem.key"
  },
  "myIP": "192.168.1.15",
  "GPSudpPort": 5067,
  "shadow": {
    "state": {
      "reported": {
        "vehicleNumber": "900"
      }
    }
  }
};
