"use strict";

// index.js
// WTA nodeOnPiOnABus
// Version 2.0
// Last updated 2016-09-11 by R. Josh Nylander
//
// Constants
const awsIoTThing = require("awsIoTThing");
const fs = require('fs');
const nmea = require("nmea");
const dgram = require("dgram");
const Emitter = require('pattern-emitter');
const EventEmitter = require('events');
const exec = require('child_process').exec;
/**
 * Turn on and off debug to console
 */
var debugOn = true;  // TODO

/**
 * //debugConsole - A helper function for debuging to console, or not
 *
 * @param  {type} msg description
 * @return {type}     description
 */
function debugConsole(msg) {
     if (debugOn) {
          console.log("DEBUG: " + msg);
     }
}


//
// Create the event model
var emitter = patternEmitterFactory();
//

// IoT variables
var awsClient;
var awsThing;

class settingsOnly extends EventEmitter {
     constructor(settingsObject, callback) {
          super();
          var _this = this;
          _this._settings = settingsObject;
     }

     reportProperty(propertyName, propertyValue, delayUpdate, callback) {
          //delayUpdate not supported
          var _this = this;
          _this.setProperty(propertyName, propertyValue);
          callback = (typeof callback === 'function') ? callback : function() {};
          callback();
     }

     setProperty(propertyName, propertyValue) {
          var _this = this;
          _this._settings[propertyName] = propertyValue;
     }

     getProperty(propertyName) {
          var _this = this;
          if (_this._settings.hasOwnProperty(propertyName)) {
               return this._settings[propertyName];
          } else {
               return null;
          }
     }
}

// Connect to AWS IoT
// Determine my MAC address and use as clientId
emitter.on("start", function() {
     debugConsole("about to getmac");
     require('getmac').getMac(function (err, mac) {
          if (err)  throw err
          awsConfig.clientId = "nodeOnPiOnABus-client-" + mac;
          emitter.emit("macAddress", mac);
          emitter.emit("clientId", awsConfig.clientId);
     });
});
emitter.on("clientId", function(clientId) {
     debugConsole("Creating awsClient with clientId of " + clientId);
     awsIoTThing.clientFactory(awsConfig, function(err, client) {
          awsClient = client;
          emitter.emit("awsClient.created", client);
     });
});

// For testing
/*emitter.on("awsClient.created", function () {
     debugConsole("awsClient.created, about to emit vehicleID");
     emitter.emit("vehicleID", "000");
}); */

//
// Begin parsing GPS data
emitter.on("GPSudpPort", function(port) {
     listenForGPS(port, emitter);
});
//
// Once I know my vehicleID...
emitter.once("vehicleID", function(id) {
     var vehicleID = id;
     var thingName = "vehicle" + id;
     // Create awsThing
     awsClient.thingFactory(thingName, {"persistentSubscribe": true}, false, function(err, thing) {
          awsThing = thing;
          debugConsole("Error: " + err);
          debugConsole(JSON.stringify(thing));
          debugConsole("thing created");
          emitter.emit("awsThing.created", thing);
          awsThing.register(function() {
               debugConsole("thing registered");
               emitter.emit("awsThing.registered", awsThing);
               awsThing.retrieveState(function(){
                    // TODO Need to copy all local settings up to thing
                    awsThing.reportProperty("vehicleId", vehicleID, false);
                    emitter.emit("awsThing.ready");
               });
          });
     });
});

//
// Attempt to update my git repo
// TODO
// Determine current commit ID
// Report it
emitter.on("awsThing.ready", function() {
     exec('git log -1 --format="%H"', (error, stdout, stderr) => {
          if (error) {
               console.error(`exec error: ${error}`);
          } else {
               debugConsole("Current git commit is: " + stdout.replace(/(\r\n|\n|\r)/gm,""));
               awsThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""));

               // Get notified of the version delta
               debugConsole("Delta git commit is: " + awsThing.getDeltaProperty("commit"));
               if (awsThing.getDeltaProperty("commit") != null) {
                    //change commit
                    var newCommit = awsThing.getDeltaProperty("commit")
                    debugConsole ("Need to update the commit to: " + newCommit);
                    exec('git fetch --all && checkout --force "' + newCommit + '"', (error, stdout, stderr) => {
                         debugConsole("git: " + stdout);
                    };
                    // Call 'git fetch --all'
                    // Call 'git checkout --force "${TARGET}"'
                    //
               }
          }
     });

});

// Update with GPS info
emitter.on("GPS.GPRMC",function(sentence){
     debugConsole("Updating lat/lon");
     awsThing.reportProperty("lat", sentence.lat, true);
     awsThing.reportProperty("lon", sentence.lon, false);
});

// GPS
emitter.on("GPS.message", function(message) {
     var msgString = message.message;
     if (msgString.indexOf("$GPRMC") > -1) {
          var sentence = nmea.parse(msgString);
          sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
          sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
          emitter.emit("GPS.GPRMC",sentence);
     }
     if (msgString.indexOf("$GPGSV") > -1) {
          var sentence = nmea.parse(msgString);
          emitter.emit("GPS.GPGSV",sentence);
     }
     if (msgString.indexOf("$GPGGA") > -1) {
          var sentence = nmea.parse(msgString);
          sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
          sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
          emitter.emit("GPS.GPGGA",sentence);
     }
     if (msgString.indexOf("$RLN") > -1) {
		var vehicleNumber = msgString.substr((msgString.indexOf(";ID=")+5),3);
          debugConsole(vehicleNumber);  // TODO remove this logging once confirmed
          emitter.emit("vehicleID", vehicleNumber);  // TODO Is this the right thing to emit?
     }
     //SAMPLE RLN MESSAGE:
     //$RLN77680000+487919234-1224970480+000170330293+0001184908020406001265171A19362458255D295B000000000032;ID=B802;*44<

});
//
// Functions
function patternEmitterFactory() {
	//https://github.com/daniaelstjules/pattern-emitter/
	//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
	var patternEmitter = new Emitter();
	patternEmitter.__emit = patternEmitter.emit;
	return patternEmitter;
}

function listenForGPS(udpPort, patternEmitter) {
	//Monitor GPS data from UDP
	var server = dgram.createSocket("udp4");
	debugConsole("Listing on UDP port " + udpPort);
	server.on("error", function (err) {
		debugConsole("server error:\n" + err.stack);
		server.close();
	});
	server.on("listening", function () {
		//this.myIP = server.address();
		debugConsole("Server is listening for udp packets...");
	});
	server.on("message", function (msg, rinfo) {
		debugConsole("Server received message...");
		var gpsMessage = new Object();
		gpsMessage.message = String(msg);
		patternEmitter.emit("GPS.message", gpsMessage);
	});
	//GPS parsing and emitting

	server.bind(udpPort);
	return server;
}

// Load settings from folder above
//var settings = require("../settings/settings.json").GPSudpPort;
var awsConfig = require("../settings/awsclientconfig.json");
awsThing = new settingsOnly(require("../settings/settings.json"));
emitter.emit("GPSudpPort", awsThing.getProperty("GPSudpPort"));
emitter.emit("start");
