//index.js
// WTA piOnABusWithNode

var localConfigPath = "./localconfig.js";
var localconfig = null;

var fs = require("fs-extra");
var request = require("request");

var getRemoteConfig = function(){
	console.log("In getRemoteConfig");
	console.log("Attempting to retrieve config file from " + localconfig.configURL + " and save to " + localconfig.saveConfigToPath);
	request(localconfig.configURL, saveRemoteConfig).pipe(fs.createWriteStream(localconfig.saveConfigToPathTemp));
};

var saveRemoteConfig = function() {
	console.log("In saveRemoteConfig");
	console.log("Retrieved " + localconfig.configURL + " and saved to " + localconfig.saveConfigToPathTemp);
	//Test before copying
	try {
		var testConfig = require(localconfig.saveConfigToPathTemp).myconfig;
		if (testConfig != undefined) {
			//Copy file then call loadRemoteConfig
			console.log("Copying " + localconfig.saveConfigToPathTemp + " to " + localconfig.saveConfigToPath);
			fs.copy(localconfig.saveConfigToPathTemp, localconfig.saveConfigToPath, function(err) {
				if (err != undefined) {
					console.log("Error copying " + localconfig.saveConfigToPathTemp + " to " + localconfig.saveConfigToPath + " of " + err);
				}
				loadRemoteConfig();
			});
		} else {
			console.log(localconfig.saveConfigToPathTemp + " not valid, using " + localconfig.saveConfigToPath);
			loadRemoteConfig();
		}
	} catch (error) {
		console.log(localconfig.saveConfigToPathTemp + " not valid, using " + localconfig.saveConfigToPath);
		loadRemoteConfig();
	}
};

var runRemoteConfig = function(config){
	console.log("In runRemoteConfig");
	console.log("Using executable: " + config.executable);
	var executable = require(config.executable);
	executable.run(config);
};

var loadRemoteConfig = function(){
	console.log("In loadRemoteConfig");
	console.log(JSON.stringify(localconfig));
	var remoteConfig = null;
	console.log("Using configPath: " + localconfig.configPath);
	if (localconfig.configPath != undefined) {
		try {
			remoteConfig = require(localconfig.configPath).myconfig;
			if (remoteConfig != undefined) {
				console.log("Loading config...");
				runRemoteConfig(remoteConfig);
			} else {
				console.log("Loading fallbackConfigPath...1");
				runRemoteConfig(require(localconfig.fallbackConfigPath).myconfig);
			}
		} catch (error) {
			console.log("Loading fallbackConfigPath...2");
			runRemoteConfig(require(localconfig.fallbackConfigPath).myconfig);
		}
	} else {
		//Use fallbackConfigPath
		console.log("Loading fallbackConfigPath...3");
		runRemoteConfig(require(localconfig.fallbackConfigPath).myconfig);
	}
};

console.log("Welcome to WTA's nodeOnPiOnABus running from " + process.cwd());
//Load the localConfigPath to load a local config
try {
	console.log("Attempting to load " + localConfigPath);
	localconfig = require(localConfigPath).localconfig;
	console.log("Local config loaded as " + JSON.stringify(localconfig));
	if (localconfig == undefined) {
		console.log("Error loading initial config, resulting in udefined, from " + localConfigPath);
		process.exit(1);
	}
} catch (error) {
	console.log("Error loading initial config, " + error + ", from " + localConfigPath);
	process.exit(1);
}

//Support for pointing to an alternate/updatable localconfig
if (localconfig.useAlternateLocalConfigPath != undefined) {
	try {
		console.log("Attempting to load alternateLocalConfig usign path " + localconfig.useAlternateLocalConfigPath);
		var alternateLocalConfig = require(localconfig.useAlternateLocalConfigPath).localconfig;
		if (alternateLocalConfig != undefined) {
			console.log("Local config loaded as " + JSON.stringify(localconfig));
			localconfig = alternateLocalConfig;
		} else {
			console.log("Error using alternate " + localconfig.useAlternateLocalConfigPath);
			console.log("localconfig unchanged");
		}
	} catch (error) {
		console.log("Error " + error + " using alternate " + localconfig.useAlternateLocalConfigPath);
		console.log("localconfig unchanged");
	}
}

//For Testing and Install support, prompt for configURL or configPath
if (process.argv[2] != undefined) {
	//Use command line argument
	var arg = process.argv[2];
	if (arg.indexOf("http") >= 0) {
		//Use as configURL
		console.log("Using command line arguement " + arg + " as configURL");
		localconfig.configURL = arg;
	} else {
		//Use as configPath
		console.log("Using command line arguement " + arg + " as configPath");
		localconfig.configPath = arg;
		//skip attempt at retrieving configURL
		delete localconfig.configURL;
	}
} // else no command line arguments

//attempt to get remote config from URL if provided
if (localconfig.configURL != undefined) {
	if (localconfig.getRemoteDelay != undefined) {
		console.log("Waiting " + localconfig.getRemoteDelay + " milliseconds to attempt to retrieve config file from " + localconfig.configURL + " and save to " + localconfig.saveConfigToPath);
		setTimeout(getRemoteConfig, localconfig.getRemoteDelay);
	} else {
		getRemoteConfig();
	}
} else {
	//Just start configPath
	if (localconfig.runDelay != undefined) {
		setTimeout(loadRemoteConfig, localconfig.runDelay);
	} else {
		loadRemoteConfig();
	}
}
