//index.js
// WTA piOnABusWithNode


/*TODO Need to write a loader function that retrieves a configuration file from
	our web server based on source IP address, if it can, and saves it locally.
*/

var myconfig = require("./myconfig.js");

var executable = require(myconfig.executable);

executable.run();

process.exit(0);
