var execName = "production";

module.exports.run = function(config) {
	console.log("In " + execName);
	var emitter = newPatternEmitter();
	var GPSSource = listenForGPS(config.GPSudpPort, emitter);
	console.log(GPSSource);

	if (config.clientCertString != undefined) {
		config.IoTConfig.clientCert = new Buffer(config.clientCertString);
	}
	if (config.privateKeyString != undefined) {
		config.IoTConfig.privateKey = new Buffer(config.privateKeyString);
	}
	console.log("About to create ThingShadow, the current config is: " + JSON.stringify(config));
	//var myThingShadow = createThingShadow(config.IoTConfig, config.shadow, config.queuePath);

	emitter.on("GPS.GPRMC", function(eventObject) {
		console.log("Emitter received GPRMC message...updating..." + JSON.stringify(eventObject));
		//myThingShadow.setStateReportedValue("latitude", eventObject.lat, false);
		//myThingShadow.setStateReportedValue("longitude", eventObject.lon, true);
	});
}

var listenForGPS = function(udpPort, patternEmitter) {
	//Monitor GPS data from UDP
	var nmea = require("nmea");
	var dgram = require("dgram");
	var server = dgram.createSocket("udp4");
	console.log(server);
	server.on("error", function (err) {
		console.log("server error:\n" + err.stack);
		server.close();
	});
	server.on("listening", function () {
		//this.myIP = server.address();
		console.log("Server is listening for udp packets...");
	});
	server.on("message", function (msg, rinfo) {
		console.log("Server received message...");
		var gpsMessage = new Object();
		gpsMessage.message = String(msg);
		patternEmitter.emit("GPS.message", gpsMessage);
	});
	//GPS parsing and emitting
	patternEmitter.on("GPS.message", function(message) {
		var msgString = message.message;
		if (msgString.indexOf("$GPRMC") > -1) {
			var sentence = nmea.parse(msgString);
			sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
			sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
			patternEmitter.emit("GPS.GPRMC",sentence);
		}
	  	if (msgString.indexOf("$GPGSV") > -1) {
			var sentence = nmea.parse(msgString);
			patternEmitter.emit("GPS.GPGSV",sentence);
	  	}
	  	if (msgString.indexOf("$GPGGA") > -1) {
			var sentence = nmea.parse(msgString);
			sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
			sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
			patternEmitter.emit("GPS.GPGGA",sentence);
	  	}
	});
	server.bind(udpPort);
	return server;
}

var newPatternEmitter = function() {
	//https://github.com/danielstjules/pattern-emitter/
	//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
	var Emitter = require('pattern-emitter');
	var patternEmitter = new Emitter();
	patternEmitter.__emit = patternEmitter.emit;
	return patternEmitter;
}

var createThingShadow = function(AWSShadowConfig, initialState, queuePath) {
	var awsIot = require('aws-iot-device-sdk');
	var Queue = require('file-queue').Queue;
	//TODO Need to move client certificates into the config file
	//TODO Handle re-registering after long disconnected states
	var thisShadow = awsIot.thingShadow(AWSShadowConfig);
	thisShadow.thingName = AWSShadowConfig.thingName;
	console.log(thisShadow.thingName);
	thisShadow.lastClientTokenUpdate = null;
	thisShadow.stateCurrent = initialState.state.reported;
	//These functions will be overridden to support the queue
	thisShadow._update = thisShadow.update;
	thisShadow._publish = thisShadow.publish;
	//Setup queue
	//TODO add support for multiple things by using seperate paths
	thisShadow._queue = new Queue(queuePath, function(err){if (err != undefined) {console.log("error setting up queue: " + err);}});
	thisShadow._tpopCommit = null;
	thisShadow._tpopRollback = null;
	thisShadow._sendQueue = function() {
		//Try to send first item in queue to AWS IoT, but only if nothing pending and status is ready is true
		var myThis = this;
		console.log("In _sendQueue");
		myThis._queue.length(function(err, length) {
		  console.log(length);
		});

		if ((myThis._tpopCommit == null) && (myThis.ready == true)) {
			console.log("About to tpop");
			myThis._queue.tpop(function(err,message,commit,rollback) {
				if (err == undefined) {
					console.log("Have message " + JSON.stringify(message));
					myThis._tpopCommit = commit;
					myThis._tpopRollback = rollback;
					if (message.type == "update") { // && connected == true? When not connected, there is no error handling and the application crashes
						console.log("Attempting AWS update " + myThis.thingName + " with " + JSON.stringify(message.content));
						myThis.lastClientTokenUpdate = myThis._update(myThis.thingName, message.content);
					} else if (message.type == "publish") {
					    myThis._publish(myThis.thingName,myThis.content);
					}
				} else {
					console.log("error in tpop " + err)
					//Process bad messages TODO
					myThis._tpopCommit = commit;
				}
	  		});
		} else {
			console.log("In tpop, ready = " + myThis.ready + " and myThis._tpopCommit = " + myThis._tpopCommit);
		}
	};
	thisShadow.update = function(stateObject) {
		var myThis = this;
		if (stateObject != undefined) {
			myThis.stateCurrent = stateObject.state.reported;
		}
		//build clean state document
		var stateDocument = new Object();
		stateDocument.state = new Object();
		stateDocument.state.reported = myThis.stateCurrent;
		//Build message to include type and content
		var message = new Object();
		message.type = "update";
		message.content = stateDocument;
		console.log("Pushing " + JSON.stringify(message) + " to queue...");
		myThis._queue.push(message);
		//TODO add error handling
		//Attempt to send now
		myThis._sendQueue();
	};
	//TODO build new publish function
	thisShadow.setStateReportedValue = function(name, value, updateNow) {
		var myThis = this;
		console.log("set " + name + " to " + value);
		myThis.stateCurrent[name] = value;
		if (updateNow) {
			myThis.stateCurrent.updated = Math.floor(new Date() / 1000);
			myThis.update();
	    }
	};
	thisShadow.on('connect', function() {
		console.log("Connected");
		thisShadow.unregister(thisShadow.thingName);
		thisShadow.register(thisShadow.thingName);
		thisShadow.ready = false;
		setTimeout( function() {
			//waited 2 seconds
			thisShadow.ready = true;
			thisShadow.update();
		}, 2000 );
	});
	thisShadow.on('offline', function() {
		console.log('offline');
		thisShadow.ready = false;
		setTimeout(function(){thisShadow.ready = true;}, 2 * 60 * 1000);
	});
	thisShadow.on('reconnect', function() {
		console.log('Trying to reconnect...');
		//Immediately fails right here every time.
		thisShadow.ready = false;
	});
	thisShadow.on('status', function(thingName, stat, clientToken, stateObject) {
		console.log('received '+stat+' on '+thingName+': '+ JSON.stringify(stateObject));
		thisShadow.lastStatus = stat;
		if (stat == 'rejected') {
			//do we need to pop the message from queue or has it already been popped?
			if (thisShadow._tpopCommit != null) {
				//call commit if works
				thisShadow._tpopCommit(function(err) { if (err) throw err; });
				//clear tpopCommit and tpopRollback
				thisShadow._tpopCommit = null;
				thisShadow._tpopRollback = null;
				//Recurse until messageQueue is empty
				thisShadow._queue.length(function(err, length) {
				  if (length>0) {
				  	console.log(length);
				  	thisShadow._sendQueue();
				  }
				});
			}
		} else {
			thisShadow.ready = true;
			thisShadow.stateReported = stateObject.state.reported;
			thisShadow.stateDesired = stateObject.state.desired;
			if (thisShadow._tpopCommit != null) {
				//call commit if works
				thisShadow._tpopCommit(function(err) { if (err) throw err; });
				//clear tpopCommit and tpopRollback
				thisShadow._tpopCommit = null;
				thisShadow._tpopRollback = null;
				//Recurse until messageQueue is empty
				thisShadow._queue.length(function(err, length) {
				  if (length>0) {
				  	console.log(length);
				  	thisShadow._sendQueue();
				  }
				});
			}
		}
	});
	//Emmitted when a delta has been received for a registered ThingShadow.
	thisShadow.on('delta', function(thingName, stateObject) {
		console.log('received delta on '+thingName+': '+ JSON.stringify(stateObject));
	});
	//Emmitted when an operation update|get|delete has timed out.
	thisShadow.on('timeout', function(thingName, clientToken) {
	//TODO should we set ready to false here?
		// thisShadow.ready = false;
		console.log('received timeout on: '+ clientToken);
		if (thisShadow._tpopCommit != null) {
			//Call rollback
			thisShadow._tpopRollback(function(err) { if (err) throw err; });
			//Clear tpopCommit and tpopRollback
			thisShadow._tpopCommit = null;
			thisShadow._tpopRollback = null;
		}
	});
	thisShadow.on('error', function() {
		console.log('error');
		thisShadow.ready = false;
	});
	return thisShadow;
}
