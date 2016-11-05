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

// enumserations
const enums = new Object();
enums.debugOutput = new Object();
enums.debugOutput.consoleOnly = "consoleOnly";
enums.debugOutput.mqttOnly = "mqttOnly";
enums.debugOutput.consoleMqtt = "consoleMqtt";
enums.debugOutput.none = "none";

enums.debugLevel = new Object();
enums.debugLevel.IMPORTANT = 1;
enums.debugLevel.INFO = 2;
enums.debugLevel.DEBUG = 3;

// TODO FOR DEBUGING LOCALLY ONLY
var doCheckGitVersion = true;

/**
 * Turn on and off debug to console and set default level
 */
var debugOutput = enums.debugOutput.consoleOnly;  // Adjustable by settings.  consoleOnly | mqttOnly | consoleMqtt | none
var debugLevel = enums.debugLevel.DEBUG;  // Adjustable by settings.  See enums above.

// Track status of piThing connection
var connected = false;

// IoT variables
var awsClient;
var piThing;
var tcpDVR = null;
var updGPS = null;

var commands = new Object();

//Settings
var awsConfig = require("../settings/awsclientconfig.json");
var settings = require("../settings/settings.json");
if ("debugOutput" in settings) {
     debugOutput = settings.debugOutput;
}
if ("debugLevel" in settings) {
     debugLevel = settings.debugLevel;
}
debugConsole("Initial settings: " + JSON.stringify(settings), enums.debugLevel.INFO);

// This function is the essense of the rest of the program.
// It runs once the thing is created.  Setup all of the ON listeners here.
function onpiThing() {
     debugConsole("Thing created, running onpiThing");

     // Listen for GPS
     updGPS = listenForGPS(piThing.getProperty("GPSudpPort"), piThing);

     // Verify we are up to date
     checkGitVersion();

     // Listen for mqttCommands
     piThing.subscribe("/vehicles/" + piThing.thingName + "/commands", {"qos": 0}, function(err, granted) {
          if (err) {
               debugConsole("Error subscribing: " + err);
          } else {
               granted.forEach(function (grantedObj) {
                    debugConsole("Subscribed to " + grantedObj.topic + " with qos " + grantedObj.qos);
               });
               piThing.on("message", function(topic, message) {
                    debugConsole("Recieved on topic " + topic + " message: " + message);
                    if (topic == "/vehicles/" + piThing.thingName + "/commands") {
                         mqttCommands(message);
                    }
               });
          }
     });

     piThing.on("GPS.RLN.message", function(msgString) {
          awsClient.publish("/vehicles/GPS.RLN.message", msgString);
     });

     piThing.once("GPS.RLN.message", function(msgString) {
          var id = msgString.substr((msgString.indexOf(";ID=")+5),3);
          // is vehicleID different then current settings
          if (id != piThing.getProperty("vehicleId")) {
               debugConsole("Updating vehicleId from " + piThing.getProperty("vehicleId") + " to " + id);
               piThing.reportProperty("vehicleId", id, false, function() {
                    piThing.retrieveState(function () {
                         writeSettings(true);
                    });
               });
          }
     });

     // If commit is different, run the checkGitVersion
     piThing.on("delta", function(state) {
          if (piThing.getDeltaProperty("commit") != null) {
               checkGitVersion();
          }
          if (piThing.getDeltaProperty("debugOutput") != null) {
               debugConsole("Changing debugOutput to: " + piThing.getDeltaProperty("debugOutput"), enums.debugLevel.INFO);
               setDebugOutput(piThing.getDeltaProperty("debugOutput"));
          }
          if (piThing.getDeltaProperty("debugLevel") != null) {
               debugConsole("Changing debugLevel to: " + piThing.getDeltaProperty("debugLevel"), enums.debugLevel.INFO);
               setDebugLevel(piThing.getDeltaProperty("debugLevel"));
          }
     });

     // Update IoT with message string TODO
     var newDVRs = ["831", "832", "833", "834", "835", "836", "837"];
     if (newDVRs.indexOf(piThing.getProperty("vehicleId")) > -1 ) {
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
               piThing.on("GPS.GPRMC.message", function(msg){
                    debugConsole("Sending data to DVR: " + msg);
                    piThing.reportProperty("dvrGPSmsg", msg, true);
                    sendToDVR(msg);
               });
          });
     }

     // Update with GPS info
     piThing.on("GPS.GPRMC",function(sentence){
          debugConsole("Updating lat/lon");
          piThing.reportProperty("lat", sentence.lat, true);
          piThing.reportProperty("lon", sentence.lon, false);
     });

     // GPS
     piThing.on("GPS.message", function(message) {
          var msgString = message.message;
          debugConsole("Recieved GPS message: " + msgString);
          if (msgString.indexOf("$GPRMC") > -1) {
               var sentence = nmea.parse(msgString);
               //sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
               //sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
               piThing.emit("GPS.GPRMC.message", msgString);
               piThing.emit("GPS.GPRMC",sentence);
          }
          if (msgString.indexOf("$GPGSV") > -1) {
               var sentence = nmea.parse(msgString);
               piThing.emit("GPS.GPGSV.message", msgString);
               piThing.emit("GPS.GPGSV",sentence);
          }
          if (msgString.indexOf("$GPGLL") > -1) {
               var sentence = nmea.parse(msgString);
               piThing.emit("GPS.GPGLL.message", msgString);
               piThing.emit("GPS.GPGLL",sentence);
          }
          if (msgString.indexOf("$GPGGA") > -1) {
               var sentence = nmea.parse(msgString);
               //sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
               //sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
               piThing.emit("GPS.GPGGA.message", msgString);
               piThing.emit("GPS.GPGGA",sentence);
          }
          if (msgString.indexOf(">RLN") > -1) {
               piThing.emit("GPS.RLN.message",msgString);
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
          debugConsole("Creating awsClient with clientId of " + awsConfig.clientId, enums.debugLevel.INFO);
          awsIoTThing.clientFactory(awsConfig, function(err, client) {
               awsClient = client;

               var thingName = "vehicle" + settings.vehicleId;
               // Create piThing
               awsClient.thingFactory(thingName, {"persistentSubscribe": true}, false, function(err, thing) {
                    piThing = thing;
                    commands.piThing = piThing;
                    if (err) {
                         debugConsole("Error: " + err);
                    }
                    debugConsole(JSON.stringify(thing));
                    debugConsole("thing created");
                    // Handle connection status changes
                    piThing.on("connect", function() {
                         connected = true;
                    });
                    piThing.on("close", function() {
                         connected = false;
                    });
                    piThing.on("offline", function() {
                         connected = false;
                    });
                    piThing.register(function() {
                         debugConsole("thing registered");
                         connected = true;
                         piThing.retrieveState(function(){
                              var propName;
                              for (propName in settings) {
                                   piThing.reportProperty(propName, settings[propName], true);
                              }
                              piThing.reportState();
                              onpiThing();
                         });
                    });
               });
          });
     });
}

//
function checkGitVersion() {
     if (doCheckGitVersion) {
          exec('git log -1 --format="%H"', (error, stdout, stderr) => {
               if (error) {
                    console.error(`exec error: ${error}`);
               } else {
                    debugConsole("Current git commit is: " + stdout.replace(/(\r\n|\n|\r)/gm,""), enums.debugLevel.INFO);
                    piThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""));

                    // Get notified of the version delta
                    debugConsole("Delta git commit is: " + piThing.getDeltaProperty("commit"), enums.debugLevel.INFO);
                    if (piThing.getDeltaProperty("commit") != null) {
                         //change commit
                         var newCommit = piThing.getDeltaProperty("commit")
                         debugConsole ("Need to update the commit to: " + newCommit, enums.debugLevel.INFO);
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
                                             piThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""), false, function() {gracefullExit();});
                                        }
                                   });
                              });
                         });
                    }
               }
          });
     }
}
commands.checkGitVersion = checkGitVersion;

function sendToDVR(message) {
     debugConsole("Send to DVR success: " + tcpDVR.write(message +  String.fromCharCode(13), "ascii"));
}
commands.sendToDVR = sendToDVR;

function writeSettings(restart) {
     if (restart === undefined) {
        restart = false;
    }
     jsonfile.writeFile("../settings/settings.json", piThing.getReported(), function (err) {
          if (err) {
               console.error(err);
          } else {
               if (restart) {
                    //exit and Restart
                    gracefullExit();
               }
          }
     });
}
commands.writeSettings = writeSettings;

function gracefullExit() {
     debugConsole("Starting a gracefull exit..", enums.debugLevel.INFO)
     // Disconnect servers
     updGPS.close();
     if (tcpDVR != null) {
          tcpDVR.end();
     }
     // Disconnect piThing
     piThing.end(false, function() {
          process.exit(0);
     });
}
commands.writeSettings = gracefullExit;

function listenForGPS(udpPort, patternEmitter) {
	//Monitor GPS data from UDP
	var server = dgram.createSocket("udp4");
	debugConsole("Listing on UDP port " + udpPort);
	server.on("error", function (err) {
		debugConsole("server error:\n" + err.stack, enums.debugLevel.IMPORTANT);
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
     debugConsole("Exiting...", enums.debugLevel.INFO);
});

function mqttConsole(msg) {
     if (connected) {
          piThing.publish("/vehicles/" + piThing.thingName + "/console", msg);
     }
}
commands.mqttConsole = mqttConsole;

/*
enums.debugOutput = new Object();
enums.debugOutput.consoleOnly = "consoleOnly";
enums.debugOutput.mqttOnly = "mqttOnly";
enums.debugOutput.consoleMqtt = "consoleMqtt";
enums.debugOutput.none = "none";

enums.debugLevel = new Object();
enums.debugLevel.IMPORTANT = 1;
enums.debugLevel.INFO = 2;
enums.debugLevel.DEBUG = 3;
*/

/**
 * //debugConsole - A helper function for debuging to console, or not
 *
 * @param  {type} msg description
 */
function debugConsole(message, level) {
     if (level  === undefined) {
          level = enums.debugLevel.DEBUG;
     }
     var levelName = "DEBUG";
     if (level <= debugLevel) {
          switch (level) {
               case 1:
                    levelName = "IMPORTANT";
                    break;
               case 2:
                    levelName = "INFO";
                    break;
               case 3:
                    levelName = "DEBUG";
                    break;
          }
          var msg = levelName + ": " + message;
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
}
commands.debugConsole = debugConsole;

function setDebugOutput(method) {
     debugOutput = method;
     piThing.reportProperty("debugOutput", debugOutput, false, function() {
          piThing.retrieveState(function () {
               writeSettings(false);
          });
     });
}
commands.setDebugOutput = setDebugOutput;

function setDebugLevel(level) {
     debugLevel = level;
     piThing.reportProperty("debugLevel", debugLevel, false, function() {
          piThing.retrieveState(function () {
               writeSettings(false);
          });
     });
}
commands.setDebugLevel = setDebugLevel;

function mqttCommands(message) {
     var code = message.toString();
     debugConsole("About to eval: " + code);
     global.f = new Function("commands", code);
     f.call(commands, commands);
     //mqttConsole(_eval(message));
}

// Ok, lets get this started
debugConsole("Lets get started");
createThing();
