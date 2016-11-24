const eventRelay = require("./eventrelay").relayFactory();
const EventEmitter = require('events');

var testEmitter = new EventEmitter();

eventRelay.addEmitter("TEST", testEmitter);

/*eventRelay.on("TEST.event", function() {
     console.log("on");
});*/

/*
eventRelay.every("TEST.event", function() {
     console.log("HELLO WORLD");
}, {method: "counter", count: 10});

setInterval(function() {testEmitter.emit("event")}, 100 * 10);
*/

eventRelay.every("TEST.event", function(arg1) {
     console.log("HELLO " + arg1);
}, {method: "timer", delay: 1000});

setInterval(function() {testEmitter.emit("event", "JOSH")}, 100);
setInterval(function() {testEmitter.emit("event", "ROBYN")}, 50);

/*
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

console.log(eventRelay.hasEmitter("PROCESS"));

eventRelay.on("PROCESS.startup", function() {console.log("startup from relay");});

process.on("startup", function() {console.log("startup from process");});

process.startup();
*/
