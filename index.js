"use strict";

// index.js
// WTA nodeOnPiOnABus
// Version 2.0.1
// Last updated 2016-09-11 by R. Josh Nylander
//
// Constants
const awsIoTThing = require("awsiotthing");
const fs = require('fs');
const nmea = require("nmea");
const dgram = require("dgram");
const exec = require('child_process').exec;
const jsonfile = require('jsonfile');
const net = require('net');
const vm = require('vm');

/**
 * Turn on and off debug to console
 */
var debugOutput = "consoleOnly";  // Adjustable by settings.  consoleOnly | mqttOnly | consoleMqtt | none

// Track status of awsThing connection
var connected = false;

// IoT variables
var awsClient;
var awsThing;
var tcpDVR = null;
var updGPS = null;

//Settings
var awsConfig = require("../settings/awsclientconfig.json");
var settings = require("../settings/settings.json");
if ("debugOutput" in settings) {
     debugOutput = settings.debugOutput;
}
debugConsole("Initial settings: " + JSON.stringify(settings));

// This function is the essense of the rest of the program.
// It runs once the thing is created.  Setup all of the ON listeners here.
function onAwsThing() {
     debugConsole("Thing created, running onAwsThing");

     // Listen for GPS
     updGPS = listenForGPS(awsThing.getProperty("GPSudpPort"), awsThing);

     // Verify we are up to date
     checkGitVersion();

     // Listen for mqttCommands
     awsClient.on("message", function(topic, message) {
          if (topic == "/vehicles/" + awsThing.thingName + "/commands") {
               mqttCommands(message);
          }
     });

     awsThing.on("GPS.RLN.message", function(msgString) {
          awsClient.publish("/vehicles/GPS.RLN.message", msgString);
     });

     awsThing.once("GPS.RLN.message", function(msgString) {
          var id = msgString.substr((msgString.indexOf(";ID=")+5),3);
          // is vehicleID different then current settings
          if (id != awsThing.getProperty("vehicleId")) {
               debugConsole("Updating vehicleId from " + awsThing.getProperty("vehicleId") + " to " + id);
               awsThing.reportProperty("vehicleId", id, false, function() {
                    awsThing.retrieveState(function () {
                         writeSettings();
                    });
               });
          }
     });

     // If commit is different, run the checkGitVersion
     awsThing.on("delta", function(state) {
          if (awsThing.getDeltaProperty("commit") != null) {
               checkGitVersion();
          }
          if (awsThing.getDeltaProperty("debugOutput") != null) {
               debugOutput = awsThing.getDeltaProperty("debugOutput");
               awsThing.reportProperty("debugOutput", debugOutput);
               writeSettings();
          }
     });

     // Update IoT with message string TODO
     var newDVRs = ["831", "832", "833", "834", "835", "836", "837"];
     if (newDVRs.indexOf(awsThing.getProperty("vehicleId")) > -1 ) {
          debugConsole("Creating connection to DVR...");
          tcpDVR = net.createConnection(5070, "192.168.1.129", function(){
               debugConsole("Connection established to DVR");
               tcpDVR.on("close", function(had_error){
                    if (had_error) {
                         debugConsole("Connection to DVR closed due to error.")
                    } else {
                         debugConsole("Connection to DVR closed.")
                    }
               });
               awsThing.on("GPS.GPRMC.message", function(msg){
                    debugConsole("Sending data to DVR: " + msg);
                    awsThing.reportProperty("dvrGPSmsg", msg, true);
                    sendToDVR(msg);
               });
          });
     }

     // Update IoT with message string TODO
     awsThing.on("GPS.GPRMC.message", function(msg){
          awsThing.reportProperty("gpsRMC", msg);
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
          debugConsole("Recieved GPS message: " + msgString);
          if (msgString.indexOf("$GPRMC") > -1) {
               var sentence = nmea.parse(msgString);
               //sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
               //sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
               awsThing.emit("GPS.GPRMC.message", msgString);
               awsThing.emit("GPS.GPRMC",sentence);
          }
          if (msgString.indexOf("$GPGSV") > -1) {
               var sentence = nmea.parse(msgString);
               awsThing.emit("GPS.GPGSV.message", msgString);
               awsThing.emit("GPS.GPGSV",sentence);
          }
          if (msgString.indexOf("$GPGLL") > -1) {
               var sentence = nmea.parse(msgString);
               awsThing.emit("GPS.GPGLL.message", msgString);
               awsThing.emit("GPS.GPGLL",sentence);
          }
          if (msgString.indexOf("$GPGGA") > -1) {
               var sentence = nmea.parse(msgString);
               //sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
               //sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
               awsThing.emit("GPS.GPGGA.message", msgString);
               awsThing.emit("GPS.GPGGA",sentence);
          }
          if (msgString.indexOf(">RLN") > -1) {
               awsThing.emit("GPS.RLN.message",msgString);
          }
          //SAMPLE RLN MESSAGE:
          //>RLN81160000+487864486-1224486923+000180380019+0000174204083E103516402728000000000012;ID=B832;*43<
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
          debugConsole("Creating awsClient with clientId of " + awsConfig.clientId);
          awsIoTThing.clientFactory(awsConfig, function(err, client) {
               awsClient = client;

               // Handle connectino status changes
               awsClient.on("connect", function() {
                    connected = true;
               });
               awsClient.on("close", function() {
                    connected = false;
               });
               awsClient.on("offline", function() {
                    connected = false;
               });

               var thingName = "vehicle" + settings.vehicleId;
               // Create awsThing
               awsClient.thingFactory(thingName, {"persistentSubscribe": true}, false, function(err, thing) {
                    awsThing = thing;
                    if (err) {
                         debugConsole("Error: " + err);
                    }
                    debugConsole(JSON.stringify(thing));
                    debugConsole("thing created");
                    awsThing.register(function() {
                         debugConsole("thing registered");
                         connected = true;
                         awsThing.retrieveState(function(){
                              var propName;
                              for (propName in settings) {
                                   awsThing.reportProperty(propName, settings[propName], true);
                              }
                              awsThing.reportState();
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
                         debugConsole("git error: " + error);
                         debugConsole("git stdout: " + stdout);
                         debugConsole("git stderr: " + stderr);
                         // Call 'git checkout --force "${TARGET}"'
                         exec('git checkout --force "' + newCommit + '"', (error, stdout, stderr) => {
                              debugConsole("git error: " + error);
                              debugConsole("git stdout: " + stdout);
                              debugConsole("git stderr: " + stderr);
                              exec('git log -1 --format="%H"', (error, stdout, stderr) => {
                                   if (error) {
                                        console.error(`exec error: ${error}`);
                                   } else {
                                        awsThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""), false, function() {gracefullExit();});
                                   }
                              });
                         });
                    });
               }
          }
     });

}

function sendToDVR(message) {
     debugConsole("Send to DVR success: " + tcpDVR.write(message +  String.fromCharCode(13), "ascii"));
}

function writeSettings() {
     jsonfile.writeFile("../settings/settings.json", awsThing.getReported(), function (err) {
          if (err) {
               console.error(err);
          } else {
               //exit and Restart
               gracefullExit();
          }
     });
}

function gracefullExit() {
     debugConsole("Starting a gracefull exit..")
     // Disconnect servers
     updGPS.close();
     if (tcpDVR != null) {
          tcpDVR.end();
     }
     // Disconnect awsThing
     awsThing.unregister();
     awsThing.end();
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
		//debugConsole("Server received message...");
		var gpsMessage = new Object();
		gpsMessage.message = String(msg);
		patternEmitter.emit("GPS.message", gpsMessage);
	});
	//GPS parsing and emitting

	server.bind(udpPort);
	return server;
}

// Setup cleanup;
process.on("beforeExit", function() {
     debugConsole("Exiting...");
});

function mqttConsole(msg) {
     if (connected) {
          awsClient.publish("/vehicles/" + awsThing.thingName + "/console", msg);
     }
}

/**
 * //debugConsole - A helper function for debuging to console, or not
 *
 * @param  {type} msg description
 */
function debugConsole(msg) {
     msg = "DEBUG: " + msg;
     switch (debugOutput) {
          case "consoleOnly":
               console.log(msg);
               break;
          case "mqttOnly":
               mqttConsole(msg);
               break;
          case "consoleMqtt":
               console.log(msg);
               mqttConsole(msg);
               break;
          case "none":
               break;
          default:
               // None
               break;
     }
}

function mqttCommands(message) {
     // This runs JavaScript commands received via mqtt
     // TODO - validation?
     mqttConsole(vm.runInThisContext(message, {"displayErrors": true, "timeout": 300}));
}

// Ok, lets get this started
debugConsole("Lets get started");
createThing();
