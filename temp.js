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
var eventRelay = require("./eventrelay").relayFactory();

// Settings
var awsConfig = require("../settings/awsclientconfig.json");
var settings = require("../settings/settings.json");

// Functions attached to this object will be available over the remote console
var commands = new Object();


eventRelay.once("PROCESS.startup", function() {debugConsole.log("hi");});


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
eventRelay.logger = debugConsole;
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

// Setup gpsListener
eventRelay.once("PROCESS.startup", function() {
	debugConsole.log("Setting up gps");
     gpsDevice.listen({source: "udp", "udpPort": 5067});
});
eventRelay.on("PROCESS.shutdown", function() {
     debugConsole.log("Exiting... Stopping gpsDevice", debugConsole.INFO);
     gpsDevice.stop();
});

process.startup();
debugConsole.log("Just fired startup");
process.shutdown();