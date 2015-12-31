//index.js
// WTA piOnABusWithNode

// var myconfig = require("./myconfig.js").myconfig;
// console.log(process.cwd());
// var executable = require(myconfig.executable);

// executable.run(myconfig);

var fs = require("fs");
var run = false;

var runIT = function(configPath, alternateConfigPath) {
	run = true;
	console.log(configPath + ", " + alternateConfigPath);
	try {
		fs.accessSync(configPath);
	} catch (e) {
		configPath = alternateConfigPath;
	}
	console.log(configPath);
	var myconfig = require(configPath).myconfig;
	console.log(myconfig.executable);
	var executable = require(myconfig.executable);
	executable.run(myconfig);
};

var getConfig = function(url, saveToPath) {
	var request = require("request");
	request(url, runIT).pipe(fs.createWriteStream(saveToPath));
	//TODO add some sort of validation
	console.log("Retrieved " + url + " and saved to " + saveToPath);
};

//Defaults
var fallbackConfigPath = "/home/pi/nodeOnPiOnABus/myconfig.js";
var saveConfigToPath = "/home/pi/nodeOnPiOnABus/remote-config.js";
var runWithConfigPath = saveConfigToPath;
var updateConfigDelay = 6000;
var runITDelay = 10000;
var configURL = "http://piconfig.fleetnet.whatcomtrans.net/config";

// //Set working directory
// var scriptPath = process.argv[1].replace("index.js", "");
// console.log('Script directory: ' + scriptPath + ' Starting directory: ' + process.cwd());

// try {
//   process.chdir(scriptPath);
//   console.log('New directory: ' + process.cwd());
// }
// catch (err) {
//   console.log('chdir: ' + err);
// }

// //Process command line arguments
if (process.argv[2] != undefined) {
	runWithConfigPath = process.argv[2];
	var runITDelay = 10000;
} else {
	console.log("Waiting " + updateConfigDelay + " milliseconds to attempt to retrieve config file from " + configURL + " and save to " + saveConfigToPath);
	setTimeout(function () {
		getConfig(configURL, saveConfigToPath, runIT);
	}, 6000);
}
console.log(runWithConfigPath);
//Get started in 10s if it hasn't already.
if (run == false) {
	setTimeout(function () {
		runIT(runWithConfigPath, fallbackConfigPath);
	}, 10000);
}