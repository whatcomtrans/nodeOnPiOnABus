//index.js
// WTA piOnABusWithNode

var fs = require("fs");

var runIT = function(configPath, alternateConfigPath) {
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
	request(url).pipe(fs.createWriteStream(saveToPath));
	//TODO add some sort of validation
	console.log("Retrieved " + url + " and saved to " + saveToPath);
};

//Defaults
var fallbackConfigPath = "./myconfig.js";
var saveConfigToPath = "./remote-config.js";
var runWithConfigPath = saveConfigToPath;
var updateConfigDelay = 60 * 100;
var runITDelay = 2 * 60 * 100;
var configURL = "http://localhost:8080/node-work2.ps1";

//Set working directory
var path = "/home/pi/nodeOnPiOnABus/index.js";
var scriptPath = path.replace("index.js", "");
console.log('Script directory: ' + scriptPath + ' Starting directory: ' + process.cwd());

try {
  process.chdir(scriptPath);
  console.log('New directory: ' + process.cwd());
}
catch (err) {
  console.log('chdir: ' + err);
}

//Process command line arguments
if (process.argv[2] != undefined) {
	runWithConfigPath = process.argv[2];
	var runITDelay = 0 * 60 * 100;
} else {
	console.log("Waiting " + updateConfigDelay + " milliseconds to attempt to retrieve config file from " + configURL + " and save to " + saveConfigToPath);
	setTimeout(getConfig, updateConfigDelay, configURL, saveConfigToPath);
}
console.log(runWithConfigPath);
//Get started
setTimeout(runIT, runITDelay, runWithConfigPath, fallbackConfigPath);
