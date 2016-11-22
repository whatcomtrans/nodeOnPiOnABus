const eventRelay = require("./eventrelay").relayFactory();

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