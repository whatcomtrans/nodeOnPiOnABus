"use strict";

// index.js
// WTA nodeOnPiOnABus
// Version 3.1.0
// Last updated November 2016 by R. Josh Nylander
//

// TODO FOR DEBUGING LOCALLY ONLY
var doCheckGitVersion = false;

// Requires
const awsIoTThing = require("awsiotthing");
const fs = require('fs');
const exec = require('child_process').exec;
const jsonfile = require('jsonfile');
const net = require('net');
var debugConsole = require("./debugconsole").consoleFactory();
var gpsDevice = require("./gpsdevice").gpsFactory();

/* The eventRelay acts as a proxy to add listeners to emitters.
 * It uses a prefix string followed by a period.  So the event
 * you want to add listener for is [PREFIX].[eventName]
 *
 * It has a special feature which allows listeners to be added
 * before the emitter exists.  This greatly simplifies building
 * of an event based model below.
*/
const eventRelay = require("./eventrelay").relayFactory();

// Settings
var awsConfig = require("../settings/awsclientconfig.json");
var settings = require("../settings/settings.json");

// Functions attached to this object will be available over the remote console
var commands = new Object();

// TODO move this to the rest of the MQTT setup
function mqttCommands(message) {
     var code = message.toString();
     debugConsole.log("About to eval: " + code);
     global.f = new Function("commands", code);
     f.call(commands, commands);
}

// Extend the process object to support a startup and shutdown event model
process.startup = function() {
     process.emit("startup");
};
process.shutdown = function(exitCode) {
     if (exitCode === undefined) {
          exitCode = 0;
     }
     process.exitCode = exitCode;
     process.emit("shutdown", exitCode);
};
eventRelay.addEmitter("PROCESS", process);
commands.shutdown = process.shutdown;
commands.startup = process.startup;


// Setup debugConsole
debugConsole.debugOutput = debugConsole.CONSOLEONLY;
debugConsole.debugLevel = debugConsole.DEBUG;
// Apply settings to debugConsole
debugConsole.apply(settings);
if ("debugTopic" in settings) {
     debugConsole.mqttTopic = settings.debugTopic;
}
debugConsole.log("Initial settings: " + JSON.stringify(settings), debugConsole.INFO);
commands.mqttConsole = debugConsole.mqttConsole;
commands.log = debugConsole.log;
commands.setDebugOutput = debugConsole.setDebugOutput;
commands.setDebugLevel = debugConsole.setDebugLevel;
commands.debugConsole = debugConsole;
eventRelay.addEmitter("LOGGER", debugConsole);
eventRelay.on("piThing.registered", function() {
     debugConsole.mqttTopic = "/vehicles/" + piThing.thingName + "/console";
     debugConsole.mqttAgent = piThing;
});

// This function is the essense of the rest of the program.
// It runs once the thing is created.  Setup all of the ON listeners here.
eventRelay.once("piThing.getAccepted", function() {
     // Listen for mqttCommands
     piThing.subscribe("/vehicles/" + piThing.thingName + "/commands", {"qos": 0}, function(err, granted) {
          if (err) {
               debugConsole.log("Error subscribing: " + err);
          } else {
               granted.forEach(function (grantedObj) {
                    debugConsole.log("Subscribed to " + grantedObj.topic + " with qos " + grantedObj.qos);
               });
               piThing.on("message", function(topic, message) {
                    debugConsole.log("Recieved on topic " + topic + " message: " + message);
                    if (topic.endsWith("/commands")) {
                         mqttCommands(message);
                    }
               });
          }
     });

     piThing.subscribe("/vehicles/pi/commands", {"qos": 0}, function(err, granted) {
          if (err) {
               debugConsole.log("Error subscribing: " + err);
          } else {
               granted.forEach(function (grantedObj) {
                    debugConsole.log("Subscribed to " + grantedObj.topic + " with qos " + grantedObj.qos);
               });
               piThing.on("message", function(topic, message) {
                    debugConsole.log("Recieved on topic " + topic + " message: " + message);
                    if (topic.endsWith("/commands")) {
                         mqttCommands(message);
                    }
               });
          }
     });

     gpsDevice.on("rawdata", function (msgString) {
          if (msgString.indexOf(">RLN") > -1) {
               //SAMPLE RLN MESSAGE:
               //>RLN81160000+487864486-1224486923+000180380019+0000174204083E103516402728000000000012;ID=B832;*43<

               piThing.emit("GPS.RLN.message", msgString);
          }
     });

     piThing.on("GPS.RLN.message", function(msgString) {
          awsClient.publish("/vehicles/GPS.RLN.message", msgString);
     });

     piThing.once("GPS.RLN.message", function(msgString) {
          var id = msgString.substr((msgString.indexOf(";ID=")+5),3);
          // is vehicleID different then current settings
          if (id != piThing.getProperty("vehicleId")) {
               debugConsole.log("Updating vehicleId from " + piThing.getProperty("vehicleId") + " to " + id);
               piThing.reportProperty("vehicleId", id, false, function() {
                    writeSettings(true);
               });
          }
     });

     // If commit is different, run the checkGitVersion
     piThing.on("delta", function(state) {
          if (piThing.getDeltaProperty("commit") != null) {
               checkGitVersion();
          }
          if (piThing.getDeltaProperty("debugOutput") != null) {
               debugConsole.log("Changing debugOutput to: " + piThing.getDeltaProperty("debugOutput"), debugConsole.INFO);
               debugConsole.debugOutput = piThing.getDeltaProperty("debugOutput");
          }
          if (piThing.getDeltaProperty("debugLevel") != null) {
               debugConsole.log("Changing debugLevel to: " + piThing.getDeltaProperty("debugLevel"), debugConsole.INFO);
               debugConsole.debugOutput = piThing.getDeltaProperty("debugLevel");
          }
     });

     debugConsole.on("changed.debugOutput", function(value) {
          piThing.reportProperty("debugOutput", value, false, function() {
               writeSettings();
          });
     });
     debugConsole.on("changed.debugLevel", function(value) {
          piThing.reportProperty("debugLevel", value, false, function() {
               writeSettings();
          });
     });
     debugConsole.on("changed.mqttTopic", function(value) {
          piThing.reportProperty("debugTopic", value, false, function() {
               writeSettings();
          });
     });

     // Update IoT with message string TODO
     var newDVRs = ["831", "832", "833", "834", "835", "836", "837"];
     if (newDVRs.indexOf(piThing.getProperty("vehicleId")) > -1 ) {
          debugConsole.log("Creating connection to DVR...");
          tcpDVR = net.createConnection(5070, "192.168.1.129", function(){
               debugConsole.log("Connection established to DVR");
               tcpDVR.on("close", function(had_error){
                    if (had_error) {
                         debugConsole.log("Connection to DVR closed due to error.")
                    } else {
                         debugConsole.log("Connection to DVR closed.")
                    }
               });
               gpsDevice.on("RMC", function(data){
                    var msg = data.raw;
                    debugConsole.log("Sending data to DVR: " + msg);
                    piThing.reportProperty("dvrGPSmsg", msg, true);
                    sendToDVR(msg);
               });
          });
     }

     // GPS
     gpsDevice.on("data", function(data) {
          // debugConsole.log("Recieved GPS message: " + JSON.stringify(data));
     });
});

// Setup gpsListener
eventRelay.once("piThing.getAccepted", function() {
     gpsDevice.listen({source: "udp", "udpPort": piThing.getProperty("GPSudpPort")});
});
eventRelay.on("PROCESS.shutdown", function() {
     debugConsole.log("Exiting... Stopping gpsDevice", debugConsole.INFO);
     gpsDevice.stop();
});

// Define global awsClient and have it configure on startup
var awsClient = null;
eventRelay.once("PROCESS.startup", function () {
     // Connect to AWS IoT
     // Determine my MAC address and use as clientId
     debugConsole.log("about to getmac");
     require('getmac').getMac(function (err, mac) {
          if (err)  throw err
          awsConfig.clientId = "nodeOnPiOnABus-client-" + mac;
          settings.macAddress = mac;
          debugConsole.log("Creating awsClient with clientId of " + awsConfig.clientId, debugConsole.INFO);
          awsClient = awsIoTThing.clientFactory(awsConfig);
          eventRelay.addEmitter("AWSClient", awsClient);
     });
});
// Track status of connection
var awsClientConnected= false;
eventRelay.on("AWSClient.connect", function() {
     awsClientConnected= true;
});
eventRelay.on("AWSClient.close", function() {
     awsClientConnected= false;
});
eventRelay.on("AWSClient.offline", function() {
     awsClientConnected= false;
});


// Add the piThing
var piThing = null;
eventRelay.once("AWSClient.connect", function(err, client) {
     // Create piThing
     awsClient.thingFactory("pi" + settings.vehicleId, {"persistentSubscribe": true}, false, function(err, thing) {
          piThing = thing;
          eventRelay.addEmitter("piThing", thing);
          commands.piThing = thing;
          if (err) {
               debugConsole.log("Error: " + err);
          }
          debugConsole.log(JSON.stringify(thing));
          debugConsole.log("thing created");
          // Handle connection status changes
          thing.register(function() {
               thing.emit("registered");
               debugConsole.log("thing registered");
               thing.retrieveState(function(){
                    var propName;
                    for (propName in settings) {
                         thing.reportProperty(propName, settings[propName], true);
                    }
                    thing.reportState();
               });
          });
     });
});
eventRelay.on("PROCESS.shutdown", function() {
     piThing.end(false, function() {
          debugConsole.log("Exiting... Stoped pi", debugConsole.INFO);
     });
});

// Rudementary DVR setup
var tcpDVR = null;
eventRelay.on("PROCESS.shutdown", function() {
     if (tcpDVR != null) {
          debugConsole.log("Exiting... Stopping tcpDVR stream", debugConsole.INFO);
          tcpDVR.end();
     }
});
function sendToDVR(message) {
     debugConsole.log("Send to DVR success: " + tcpDVR.write(message +  String.fromCharCode(13), "ascii"));
}
commands.sendToDVR = sendToDVR;

function writeSettings(restart, stateUpdated) {
     debugConsole.log("About to write settings...");
     if (restart === undefined) {
          restart = false;
     }
     if (piThing != null) {
          if (stateUpdated === undefined) {
               piThing.retrieveState(function () {
                    writeSettings(true, true);
               });
          } else {
               settings = piThing.getReported();
          }
     }
     jsonfile.writeFile("../settings/settings.json", settings, function (err) {
          if (err) {
               console.error(err);
          } else {
               if (restart) {
                    //exit and Restart
                    commands.exit();
               }
          }
     });
}
commands.writeSettings = writeSettings;

// versioning via Git
eventRelay.once("piThing.getAccepted", function() {
     // Verify we are up to date
     checkGitVersion();
});
function checkGitVersion() {
     if (doCheckGitVersion) {
          exec('git log -1 --format="%H"', (error, stdout, stderr) => {
               if (error) {
                    console.error(`exec error: ${error}`);
               } else {
                    debugConsole.log("Current git commit is: " + stdout.replace(/(\r\n|\n|\r)/gm,""), debugConsole.INFO);
                    piThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""));

                    // Get notified of the version delta
                    debugConsole.log("Delta git commit is: " + piThing.getDeltaProperty("commit"), debugConsole.INFO);
                    if (piThing.getDeltaProperty("commit") != null) {
                         //change commit
                         var newCommit = piThing.getDeltaProperty("commit")
                         debugConsole ("Need to update the commit to: " + newCommit, debugConsole.INFO);
                         // Call 'git fetch --all'
                         exec('git fetch --all', (error, stdout, stderr) => {
                              debugConsole.log("git error: " + error);
                              debugConsole.log("git stdout: " + stdout);
                              debugConsole.log("git stderr: " + stderr);
                              // Call 'git checkout --force "${TARGET}"'
                              exec('git checkout --force "' + newCommit + '"', (error, stdout, stderr) => {
                                   debugConsole.log("git error: " + error);
                                   debugConsole.log("git stdout: " + stdout);
                                   debugConsole.log("git stderr: " + stderr);
                                   exec('git log -1 --format="%H"', (error, stdout, stderr) => {
                                        if (error) {
                                             console.error(`exec error: ${error}`);
                                        } else {
                                             piThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""), false, function() {commands.exit();});
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

// Ok, lets get this started
debugConsole.log("Lets get started");
createClient();
