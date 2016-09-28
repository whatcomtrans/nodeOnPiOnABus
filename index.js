"use strict";

// index.js
// WTA nodeOnPiOnABus
// Version 0.2.3
// Last updated 2016-09-11 by R. Josh Nylander
//
// Constants
const awsIoTThing = require("awsIoTThing");
const fs = require('fs');
const nmea = require("nmea");
const dgram = require("dgram");
const exec = require('child_process').exec;
var jsonfile = require('jsonfile')

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

// IoT variables
var awsClient;
var awsThing;

//Settings
var awsConfig = require("../settings/awsclientconfig.json");
var settings = require("../settings/settings.json");

// This function is the essense of the rest of the program.
// It runs once the thing is created.  Setup all of the ON listeners here.
function onAwsThing() {
     // Listen for GPS
     listenForGPS(awsThing.getProperty("GPSudpPort"), awsThing);

     // Verify we are up to date
     checkGitVersion();

     awsThing.once("vehicleID", function(id) {
          // is vehicleID different then current settings
          if (id != awsThing.getProperty("vehicleId")) {
               awsThing.reportProperty("vehicleId", id, false, function() {
                    awsThing.retrieveState(function () {
                         jsonfile.writeFile("../settings/settings.json", awsThing.getReported(), function (err) {
                              if (err) {
                                   console.error(err);
                              } else {
                                   //exit and Restart
                                   process.exit(1);
                              }
                         });
                    });
               });
          }
     });

     // If commit is different, run the checkGitVersion
     awsThing.on("delta", function(state) {
          if (awsThing.getDeltaProperty("commit") != null) {
               checkGitVersion();
          }
     });

     // Update with GPS info
     awsThing.on("GPS.GPRMC",function(sentence){
          debugConsole("Updating lat/lon");
          awsThing.reportProperty("lat", sentence.lat, true);
          awsThing.reportProperty("lon", sentence.lon, false);
     });

     // GPS
     awsThing.on("GPS.message", function(message) {
          var msgString = message.message;
          if (msgString.indexOf("$GPRMC") > -1) {
               var sentence = nmea.parse(msgString);
               sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
               sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
               awsThing.emit("GPS.GPRMC",sentence);
          }
          if (msgString.indexOf("$GPGSV") > -1) {
               var sentence = nmea.parse(msgString);
               awsThing.emit("GPS.GPGSV",sentence);
          }
          if (msgString.indexOf("$GPGGA") > -1) {
               var sentence = nmea.parse(msgString);
               sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
               sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
               awsThing.emit("GPS.GPGGA",sentence);
          }
          if (msgString.indexOf("$RLN") > -1) {
     		var vehicleNumber = msgString.substr((msgString.indexOf(";ID=")+5),3);
               debugConsole(vehicleNumber);  // TODO remove this logging once confirmed
               awsThing.emit("vehicleID", vehicleNumber);  // TODO Is this the right thing to emit?
          }
          //SAMPLE RLN MESSAGE:
          //$RLN77680000+487919234-1224970480+000170330293+0001184908020406001265171A19362458255D295B000000000032;ID=B802;*44<
     });

}

function createThing() {
     // Connect to AWS IoT
     // Determine my MAC address and use as clientId
     debugConsole("about to getmac");
     require('getmac').getMac(function (err, mac) {
          if (err)  throw err
          awsConfig.clientId = "nodeOnPiOnABus-client-" + mac;
          settings.macAddress = mac;
          debugConsole("Creating awsClient with clientId of " + clientId);
          awsIoTThing.clientFactory(awsConfig, function(err, client) {
               awsClient = client;
               var thingName = "vehicle" + settings.vehicleId;
               // Create awsThing
               awsClient.thingFactory(thingName, {"persistentSubscribe": true}, false, function(err, thing) {
                    awsThing = thing;
                    debugConsole("Error: " + err);
                    debugConsole(JSON.stringify(thing));
                    debugConsole("thing created");
                    awsThing.register(function() {
                         debugConsole("thing registered");
                         awsThing.retrieveState(function(){
                              // TODO Need to copy all local settings up to thing
                              awsThing.reportProperty("vehicleId", settings.vehicleId, false);
                              onAwsThing();
                         });
                    });
               });
          });
     });
}

//
function checkGitVersion() {
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
                    // Call 'git fetch --all'
                    exec('git fetch --all', (error, stdout, stderr) => {
                         debugConsole("git: " + stdout);
                         // Call 'git checkout --force "${TARGET}"'
                         exec('git checkout --force "' + newCommit + '"', (error, stdout, stderr) => {
                              debugConsole("git: " + stdout);
                              exec('git log -1 --format="%H"', (error, stdout, stderr) => {
                                   if (error) {
                                        console.error(`exec error: ${error}`);
                                   } else {
                                        awsThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""));
                                   }
                              });
                         });
                    });
               }
          }
     });

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

// Ok, lets get this started
createThing();
