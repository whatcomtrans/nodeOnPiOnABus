"use strict";

// index.js
// WTA nodeOnPiOnABus
// Version 3.0.1
// Last updated 2016-09-11 by R. Josh Nylander
//
// Constants
const awsIoTThing = require("awsiotthing");
const fs = require('fs');
const exec = require('child_process').exec;
const jsonfile = require('jsonfile');
const net = require('net');
var debugConsole = require("./debugconsole").consoleFactory();
var gpsDevice = require("./gpsDevice").gpsFactory();


// TODO FOR DEBUGING LOCALLY ONLY
var doCheckGitVersion = false;

/**
 * Turn on and off debug to console and set default level
 */
debugConsole.debugOutput = debugConsole.CONSOLEONLY;
debugConsole.debugLevel = debugConsole.DEBUG;

// Track status of piThing connection
var connected = false;

// IoT variables
var awsClient = null;
var piThing = null;
var tcpDVR = null;

var commands = new Object();

//Settings
var awsConfig = require("../settings/awsclientconfig.json");
var settings = require("../settings/settings.json");
if ("debugOutput" in settings) {
     debugConsole.debugOutput = settings.debugOutput;
}
if ("debugLevel" in settings) {
     debugConsole.debugLevel = settings.debugLevel;
}
if ("debugTopic" in settings) {
     debugConsole.mqttTopic = settings.debugTopic;
}
debugConsole.log("Initial settings: " + JSON.stringify(settings), debugConsole.INFO);

// This function is the essense of the rest of the program.
// It runs once the thing is created.  Setup all of the ON listeners here.
function onpiThing() {
     debugConsole.log("Thing created, running onpiThing");

     // Listen for GPS
     gpsDevice.listen({source: "udp", "udpPort": piThing.getProperty("GPSudpPort")});

     // Verify we are up to date
     checkGitVersion();

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
          console.log("debugOutput property start");
          piThing.reportProperty("debugOutput", value, true, function() {
               console.log("debugOutput property writing");
               writeSettings();
          });
     });
     debugConsole.on("changed.debugLevel", function(value) {
          piThing.reportProperty("debugLevel", value, true, function() {
               writeSettings();
          });
     });
     debugConsole.on("changed.mqttTopic", function(value) {
          piThing.reportProperty("debugTopic", value, true, function() {
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
          debugConsole.log("Recieved GPS message: " + JSON.stringify(data));
     });
}

function createThing() {
     // Connect to AWS IoT
     // Determine my MAC address and use as clientId
     debugConsole.log("about to getmac");
     require('getmac').getMac(function (err, mac) {
          if (err)  throw err
          awsConfig.clientId = "nodeOnPiOnABus-client-" + mac;
          settings.macAddress = mac;
          debugConsole.log("Creating awsClient with clientId of " + awsConfig.clientId, debugConsole.INFO);
          awsIoTThing.clientFactory(awsConfig, function(err, client) {
               awsClient = client;

               var thingName = "pi" + settings.vehicleId;
               // Create piThing
               awsClient.thingFactory(thingName, {"persistentSubscribe": true}, false, function(err, thing) {
                    piThing = thing;
                    commands.piThing = piThing;
                    if (err) {
                         debugConsole.log("Error: " + err);
                    }
                    debugConsole.log(JSON.stringify(thing));
                    debugConsole.log("thing created");
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
                         debugConsole.log("thing registered");
                         connected = true;
                         debugConsole.mqttTopic = "/vehicles/" + piThing.thingName + "/console";
                         debugConsole.mqttAgent = piThing;
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
                                             piThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""), false, function() {gracefulExit();});
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
                    gracefulExit();
               }
          }
     });
}
commands.writeSettings = writeSettings;

function gracefulExit() {
     debugConsole.log("Starting a gracefull exit..", debugConsole.INFO)
     // Disconnect servers
     gpsDevice.stop();
     if (tcpDVR != null) {
          tcpDVR.end();
     }
     // Disconnect piThing
     piThing.end(false, function() {
          process.exit(0);
     });
}
commands.gracefulExit = gracefulExit;

// Setup cleanup;
process.on("beforeExit", function() {
     debugConsole.log("Exiting...", debugConsole.INFO);
});

commands.mqttConsole = debugConsole.mqttConsole;
commands.log = debugConsole.log;
commands.setDebugOutput = debugConsole.setDebugOutput;
commands.setDebugLevel = debugConsole.setDebugLevel;
commands.debugConsole = debugConsole;

function mqttCommands(message) {
     var code = message.toString();
     debugConsole.log("About to eval: " + code);
     global.f = new Function("commands", code);
     f.call(commands, commands);
     //mqttConsole(_eval(message));
}

// Ok, lets get this started
debugConsole.log("Lets get started");
createThing();
