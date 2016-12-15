"use strict";

// index.js
// WTA nodeOnPiOnABus
// Version 3.5.1
// Last updated November 2016 by R. Josh Nylander
//

// TODO FOR DEBUGING LOCALLY ONLY
var doCheckGitVersion = true;

// A run level allows us to quickly enable/disable sections of the script below
// Each section should be ordered based on dependencies.
var runLevel = 1000;

// Requires
const awsIoTThing = require("awsiotthing");
const fs = require('fs');
const exec = require('child_process').exec;
const jsonfile = require('jsonfile');  // May no longer be needed
const net = require('net');
const dgram = require("dgram");
const thingSettings = require("./thingsettings.js");
var debugConsole = require("./debugconsole").consoleFactory();

// Gather command line arguments and setup Defaults
// https://github.com/yargs/yargs
// DEFAULT values
var argv = require('yargs')
          .usage('Usage: $0 --debugLevel [num] --debugOutput [string] --runLevel [num] --doCheckGitVersion [boolean]')
          .default('debugOutput', debugConsole.CONSOLEONLY)
          .choices('debugOutput', ['CONSOLEONLY', 'CONSOLEMQTT', 'MQTTONLY', 'NONE'])
          .coerce('debugOuput', function(arg) {return arg.toUpperCase();})
          .default('debugLevel', debugConsole.DEBUG)
          .default('runLevel', 1000)
          .boolean('doCheckGitVersion')
          .default('doCheckGitVersion', doCheckGitVersion)
          .argv;

// Functions attached to this object will be available over the remote console
var commands = new Object();

/* The listenerRelay.acts as a proxy to add listeners to emitters.
 * It uses a prefix string followed by a period.  So the event
 * you want to add listener for is [PREFIX].[eventName]
 *
 * It has a special feature which allows listeners to be added
 * before the emitter exists.  This greatly simplifies building
 * of an event based model below.
*/
const listenerRelay = require("./eventrelay").relayFactory();
listenerRelay.logger = debugConsole;

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
process.on("shutdown", function() {
     //Failsafe to eventually exit
     setTimeout(function() {process.exit();}, 100 * 30);
});
listenerRelay.addEmitter("PROCESS", process);
commands.shutdown = process.shutdown;
commands.startup = process.startup;


if (runLevel >= 1) {  // Accept command line options to set runLevel and debugLevel
     // set runLevel
     // Note, this is the only way to set a non-default runLevel.
     // Even though it is reported in the settings, it can not be changed via IoT
     runLevel = argv.runLevel;

     // Note, this is the only way to set a non-default doCheckGitVersion.
     // Even though it is reported in the settings, it can not be changed via IoT
     // TODO consider removing this altogether
     doCheckGitVersion = argv.doCheckGitVersion;

     // Setup debugConsole
     debugConsole.debugOutput = argv.debugOutput;  // debugConsole.CONSOLEONLY;
     debugConsole.debugLevel = argv.debugLevel;  // debugConsole.DEBUG;
}

if (runLevel >= 3) {   // Settings management
     delete argv.debugOutput;  // prevent poluting settings
     delete argv.debugLevel;  // prevent poluting settings
     var piThing = new thingSettings("../settings/pisettings.json", argv);
     piThing.reportProperty("runLevel", runLevel);
     piThing.reportProperty("doCheckGitVersion", doCheckGitVersion);
     debugConsole.log("Settings loaded.  Configuring with runLevel " + runLevel + ".");
}

if (runLevel >= 4) {  // Advanced debugConsole setup
     // Apply settings to debugConsole
     Object.assign(debugConsole, piThing.getProperty("debugConsole"));
     debugConsole.log("Initial settings: " + JSON.stringify(piThing), debugConsole.INFO);
     listenerRelay.addEmitter("LOGGER", debugConsole);
     // write out settings file when they are changed
     listenerRelay.on("LOGGER.changed", function(name, settings) {
          debugConsole.log("debugConsole detected settings change to setting: " + name + ".  New settings are: " + JSON.stringify(settings) + ", saving...");
          piThing.reportProperty("debugConsole", settings, false, function() {
               piThing.writeSettings();
          });
     });
     listenerRelay.on("piThing.registered", function() {
          if (debugConsole.mqttTopic == null) {
               debugConsole.mqttTopic = "/vehicles/" + piThing.thingName + "/console";
          }
          debugConsole.mqttAgent = piThing;
     });
     listenerRelay.on("piThing.delta", function(state) {
          if (piThing.getDeltaProperty("debugConsole") != null) {
               var settings = piThing.getDeltaProperty("debugConsole");
               debugConsole.log("Changing debugConsole settings to: " + settings, debugConsole.INFO);
               Object.assign(debugConsole, settings);
          }
     });
     commands.debugConsole = debugConsole;
}

if (runLevel >= 5) {   // Git versioning
     // versioning via Git
     listenerRelay.once("piThing.getAccepted", function() {
          // Verify we are up to date
          checkGitVersion();
     });
     // If commit is different, run the checkGitVersion
     listenerRelay.on("piThing.delta", function(state) {
          if (piThing.getDeltaProperty("commit") != null) {
               checkGitVersion();
          }
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
                              debugConsole.log("Need to update the commit to: " + newCommit, debugConsole.INFO);
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
                                                  piThing.reportProperty("commit", stdout.replace(/(\r\n|\n|\r)/gm,""), false);
                                                  // Once value is changed, we listen for the commitChanged event, see below
                                             }
                                        });
                                   });
                              });
                         }
                    }
               });
          }
     }
     listenerRelay.on("piThing.commitChanged", function() {
          debugConsole.log("piThing.commitChanged, writing settings and then shutdown")
          piThing.writeSettings(function() {process.shutdown();});
     });
     commands.checkGitVersion = checkGitVersion;
}

if (runLevel >= 6) {  // Setup alerts publisher
    var alerts = require("./alerts").alerterFactory({
        "mqttTopic": "/vehicles/alerts",
        "vehicleId": piThing.getProperty("vehicleId"),
        "logger": debugConsole,
        "defaultSource": "pi"
    });
    commands.alerts = alerts;

    listenerRelay.once("AWSClient.firstConnect", function() {
          alerts.mqttAgent = awsClient;
          // alerts.publishAlert("Ready to send alerts...");
     });
     listenerRelay.on("PROCESS.shutdown", function() {
         alerts.stop();
     });
}

if (runLevel >= 7) {  // Track and periodically report uptime to console
    var runTime = new Date();

    debugConsole.log("Uptime of " + Math.round((((new Date()) - runTime) / 1000)) + " seconds.", debugConsole.INFO);

    var runTimerShort = setInterval(function() {
        debugConsole.log("Uptime of " + Math.round((((new Date()) - runTime) / 1000)) + " seconds.", debugConsole.INFO);
    }, 1000 * 10);
    var runTimerLong = setInterval(function() {
        debugConsole.log("Uptime of " + Math.round((((new Date()) - runTime) / 60000)) + " minutes.", debugConsole.INFO);
        if (runTimerShort != null) {
            clearInterval(runTimerShort);
            runTimerShort = null;
        }
    }, 1000 * 60);

     listenerRelay.on("PROCESS.shutdown", function() {
         if (runTimerShort != NULL) {
            clearInterval(runTimerShort);
            runTimerShort = NULL;
        }
        if (runTimerLong != NULL) {
            clearInterval(runTimerLong);
            runTimerLong = NULL;
        }
     });
}

if (runLevel >= 10) {   // GPS lisener
     // Setup gpsListener
     var gpsDevice = require("./gpsdevice").gpsFactory();

     gpsDevice.logger = debugConsole;
     commands.gpsDevice = gpsDevice;
     listenerRelay.addEmitter("GPS", gpsDevice);

     if (piThing.getProperty("sourceGPS") != null) {
          // Have settings now, go ahead and setup the gpsDevice
          gpsDevice.listen(piThing.getProperty("sourceGPS"));
          debugConsole.log("sourceGPS to listen: " + JSON.stringify(piThing.getProperty("sourceGPS")));
     }

     // Setup listner to capture settings changes and restart the gpsDevice
     listenerRelay.on("piThing.delta", function(state) {
          if (piThing.getDeltaProperty("sourceGPS") != null) {
               var gpsSettings = piThing.getDeltaProperty("sourceGPS");
               debugConsole.log("Changing sourceGPS settings to: " + JSON.stringify(gpsSettings), debugConsole.INFO);
               piThing.reportProperty("sourceGPS", gpsSettings, false, function() {
                    debugConsole.log("Saving settings...");
                    piThing.writeSettings();
                    debugConsole.log("Updating sourceGPS settings...");
                    gpsDevice.listen(piThing.getProperty("sourceGPS"));
                    debugConsole.log("sourceGPS to listen: " + JSON.stringify(piThing.getProperty("sourceGPS")));
               });
          }
     });

     listenerRelay.on("PROCESS.shutdown", function() {
          debugConsole.log("Exiting... Stopping gpsDevice", debugConsole.INFO);
          gpsDevice.stop();
     });
}

if (runLevel >= 11) {
     listenerRelay.on("GPS.rawdata", function (msgString) {
          if (msgString.indexOf(">RLN") > -1) {
               debugConsole.log("Found a RLN message: " + msgString)  //, parsed as: " + JSON.stringify(gpsDevice.Parse(msgString)));
               //SAMPLE RLN MESSAGE:
               //>RLN81160000+487864486-1224486923+000180380019+0000174204083E103516402728000000000012;ID=B832;*43<
               gpsDevice.emit("RLN", {raw: msgString});
          }
     });
}

if (runLevel >= 12) {  // Changing vehicleID based on RLN from GPS
     // Detect vehicleID and set it, updating settings as we go.
     listenerRelay.once("GPS.RLN", function(data) {
          var msgString = data.raw;
          var id = msgString.substr((msgString.indexOf(";ID=")+5),3);
          // is vehicleID different then current settings
          if (id != piThing.getProperty("vehicleId")) {
               debugConsole.log("Updating vehicleId from " + piThing.getProperty("vehicleId") + " to " + id + ", writing new settings and shutting down.", debugConsole.INFO);
               piThing.setProperty("vehicleId", id);
               piThing.writeSettings(function() {process.shutdown();});
          }
     });
}

if (runLevel >= 20) {  // AWS IoT Client
     // Define global awsClient and have it configure on startup
     var awsConfig = require("../settings/awsclientconfig.json");

     var awsClient = null;
     var awsClientFirstConnect = true;
     awsIoTThing.setLogger(debugConsole);
     listenerRelay.once("PROCESS.startup", function () {
          // Connect to AWS IoT
          // Determine my MAC address and use as clientId
          debugConsole.log("about to getmac");
          require('getmac').getMac(function (err, mac) {
               if (err)  throw err
               awsConfig.clientId = "nodeOnPiOnABus-client-" + mac;
               piThing.setProperty("macAddress", mac);
               debugConsole.log("Creating awsClient with clientId of " + awsConfig.clientId, debugConsole.INFO);
               awsClient = awsIoTThing.clientFactory(awsConfig);
               listenerRelay.addEmitter("AWSClient", awsClient);
          });
          listenerRelay.once("AWSClient.connect", function() {
               // Connect gets fired a lot but I need one emit which only fires first time
               if (awsClientFirstConnect) {
                    awsClientFirstConnect = false;
                    awsClient.emit("firstConnect");
               }
          })
     });
}

if (runLevel >= 21) {  // MQTT remote command processing support
     function mqttCommands(message) {
          var code = message.toString();
          debugConsole.log("About to eval: " + code, debugConsole.INFO);
          global.f = new Function("commands", code);
          f.call(commands, commands);
     }
     listenerRelay.once("piThing.registered", function() {
          awsClient.subscribe("/vehicles/" + piThing.thingName + "/commands", {"qos": 0}, function(err, granted) {
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
     });
     listenerRelay.once("AWSClient.firstConnect", function() {
          awsClient.subscribe("/vehicles/pi/commands", {"qos": 0}, function(err, granted) {
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

     });
}

if (runLevel >= 25) {  // Publish RLN messages to mqtt topic for AVL
     listenerRelay.on("AWSClient.firstConnect", function() {          listenerRelay.on("GPS.RLN", function (data) {
               awsClient.publish("/vehicles/GPS.RLN.message/" + piThing.getProperty("vehicleId"), data.raw);
          });
     });
}

if (runLevel >= 30) {  // AWS IoT thing representing this Pi
     // Add the piThing
     listenerRelay.once("AWSClient.firstConnect", function(err, client) {
          // Create piThing
          debugConsole.log("About to create piThing");
          awsClient.thingFactory("pi" + piThing.getProperty("vehicleId"), {"persistentSubscribe": true}, false, function(err, thing) {
               piThing = piThing.copyTo(thing);
               listenerRelay.addEmitter("piThing", piThing);
               commands.piThing = piThing;
               if (err) {
                    debugConsole.log("Error: " + err);
               }
               debugConsole.log(JSON.stringify(piThing));
               debugConsole.log("piThing created");
               // Handle connection status changes
               thing.register(function() {
                    thing.emit("registered");
                    debugConsole.log("piThing thing registered");
                    thing.retrieveState(function(){
                         thing.reportState();
                    });
                    // Periodically reportState, every 10 minutes
                    setInterval(function() {piThing.reportState(); piThing.writeSettings()}, 10 * 60 * 1000);
               });
          });
     });
     listenerRelay.on("PROCESS.shutdown", function() {
          piThing.end(false, function() {
               debugConsole.log("Exiting... Stopped piThing", debugConsole.INFO);
          });
     });
}

if (runLevel >= 40) {  // DVR
     var dvrThing = new thingSettings("../settings/dvrsettings.json");
     listenerRelay.once("AWSClient.firstConnect", function(err, client) {
          // Create dvrThing
          debugConsole.log("About to create fareboxThing");
          awsClient.thingFactory("farebox" + piThing.getProperty("vehicleId"), {"persistentSubscribe": true}, false, function(err, thing) {
               dvrThing = dvrThing.copyTo(thing);
               listenerRelay.addEmitter("dvrThing", dvrThing);
               commands.dvrThing = dvrThing;
               if (err) {
                    debugConsole.log("Error: " + err);
               }
               debugConsole.log(JSON.stringify(dvrThing));
               debugConsole.log("dvrThing created");
               // Handle connection status changes
               dvrThing.register(function() {
                    dvrThing.emit("registered");
                    debugConsole.log("dvrThing registered");
                    dvrThing.retrieveState(function(){
                         dvrThing.reportState();
                    });
                    // Periodically reportState, every 10 minutes
                    setInterval(function() {dvrThing.reportState();}, 10 * 60 * 1000);
               });
          });
     });
     listenerRelay.on("PROCESS.shutdown", function() {
          dvrThing.end(false, function() {
               debugConsole.log("Exiting... Stopped dvrThing", debugConsole.INFO);
          });
     });
}

if (runLevel >= 41) {  // Forward GPS to DVR
     listenerRelay.on("GPS.GLL", function(data) {
          if ((dvrThing.udpPort != null) && (dvrThing.ipAddress != null)) {
               var udpClient = dgram.createSocket("udp4");
               var message = new Buffer(data.raw);
               udpClient.send(message, 0, message.length, dvrThing.udpPort, dvrThing.ipAddress,  function() {
                    debugConsole.log("Sent to dvr: '" + message + "'");
                    udpClient.close();
               });
          }
     });
}

if (runLevel >= 42) {  // Rudementary GPS to DVR over TCP setup for Gen 5 DVRs
     var tcpDVR = null;
     var newDVRs = ["831", "832", "833", "834", "835", "836", "837"];
     if (newDVRs.indexOf(piThing.getProperty("vehicleId")) > -1 ) {
          listenerRelay.on("PROCESS.shutdown", function() {
               if (tcpDVR != null) {
                    debugConsole.log("Exiting... Stopping tcpDVR stream", debugConsole.INFO);
                    tcpDVR.end();
               }
          });

          function sendToDVR(message) {
               debugConsole.log("Send to DVR success: " + tcpDVR.write(message +  String.fromCharCode(13), "ascii"));
          }
          commands.sendToDVR = sendToDVR;

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
               listenerRelay.on("GPS.RMC", function(data){
                    var msg = data.raw;
                    debugConsole.log("Sending data to DVR: " + msg);
                    //piThing.reportProperty("dvrGPSmsg", msg, true);
                    sendToDVR(msg);
               });
          });
     }
}

if (runLevel >= 50) {  // Farebox
     var fareboxThing = new thingSettings("../settings/fareboxsettings.json");
     listenerRelay.once("AWSClient.firstConnect", function(err, client) {
          // Create fareboxThing
          debugConsole.log("About to create fareboxThing");
          awsClient.thingFactory("farebox" + piThing.getProperty("vehicleId"), {"persistentSubscribe": true}, false, function(err, thing) {
               fareboxThing = fareboxThing.copyTo(thing);
               listenerRelay.addEmitter("fareboxThing", fareboxThing);
               commands.fareboxThing = fareboxThing;
               if (err) {
                    debugConsole.log("Error: " + err);
               }
               debugConsole.log(JSON.stringify(fareboxThing));
               debugConsole.log("fareboxThing created");
               // Handle connection status changes
               fareboxThing.register(function() {
                    fareboxThing.emit("registered");
                    debugConsole.log("fareboxThing registered");
                    fareboxThing.retrieveState(function(){
                         fareboxThing.reportState();
                    });
                    // Periodically reportState, every 10 minutes
                    setInterval(function() {fareboxThing.reportState();}, 10 * 60 * 1000);
               });
          });
     });
     listenerRelay.on("PROCESS.shutdown", function() {
          fareboxThing.end(false, function() {
               debugConsole.log("Exiting... Stopped fareboxThing", debugConsole.INFO);
          });
     });
}

if (runLevel >= 51) {  // Forward GPS to Farebox
     listenerRelay.every("GPS.GLL", function(data) {
          if ((fareboxThing.udpPort != null) && (fareboxThing.ipAddress != null)) {
               var udpClient = dgram.createSocket("udp4");
               var message = new Buffer(data.raw);
               udpClient.send(message, 0, message.length, fareboxThing.udpPort, fareboxThing.ipAddress,  function() {
                    debugConsole.log("Sent to farebox: '" + message + "'");
                    udpClient.close();
               });
          }
     }, {method: "counter", dely: 10});
}

if (runLevel >= 60) {  // Test connectivity to other devices via PING
    var netMonitor = require("./netmonitor").netmonitorFactory({
        "logger": debugConsole
    });
    listenerRelay.on("PROCESS.shutdown", function() {
          netMonitor.stop();
     });
}

// Ok, lets get this started
debugConsole.log("Emitting startup event.");
process.startup();
