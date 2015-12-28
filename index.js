//index.js
// WTA piOnABusWithNode


/*TODO Need to write a loader function that retrieves a configuration file from
	our web server based on source IP address, if it can, and saves it locally.
*/

var runIT = function() {
	var myconfig = require("./myconfig.js").myconfig;
	console.log(myconfig.executable);
	var executable = require(myconfig.executable);
	executable.run(myconfig);
};

var getConfig = function() {
	var fs = require("fs");
	var request = require("request");
	request("http://localhost:8080/node-work2.ps1").pipe(fs.createWriteStream("./myconfig.js"));
};

setTimeout(getConfig, 1);
setTimeout(runIT, 10000);
