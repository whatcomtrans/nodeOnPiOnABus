module.exports.localconfig = {
  "useAlternateLocalConfigPath": "../remote-config.js",
  "configPath": "../remote-config.js",
  "fallbackConfigPath": "./localconfig.js",
  "saveConfigToPath": "../remote-config.js",
  "saveConfigToPathTemp": "../remote-config-temp.js",
  "configURL": "http://piconfig.fleetnet.whatcomtrans.net/config",
  "runDelay": 1.5 * 60 * 1000,
  "getRemoteDelay": 1 * 60 * 1000
};

module.exports.myconfig = {
  "executable": "./test.js",
  "queuePath": "../queue",
  "IoTConfig": {
    "host": "A6R7AFY5KV5WL.iot.us-west-2.amazonaws.com",
    "port": 8883,
    "reconnectPeriod":10000,
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
        "VehicleNumber": "900"
      }
    }
  }
};
