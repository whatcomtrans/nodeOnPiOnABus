//Global Objects
var runConfig;
var emitter;
var awsThingShadow;
var messageQueue;
var tpopCommit = null;
var tpopRollback = null;

//What is the point of this GPRMC listener outside of the listenForGPS function? Why not put it inside that function?
emitter.on("GPS\.GPRMC/", function(message) {
  //TODO Update local state runConfig
  //Set the lat/long value and update timestamp on myconfig
  runConfig.shadow.state.desired.lat = sentence.lat;
  runConfig.shadow.state.desired.lon = sentence.lon;
  runConfig.shadow.state.desired.updated = Math.floor(new Date() / 1000);

  updateState();
}

var updateState = function () {
	//Add status to end of queue
  	messageQueue.push(runConfig.shadow.state, function(err){
    	//Attempt to send directly to AWS then exit
    	thingShadows.update(thingName,shadow);
    	process.exit(0);
  	});
  	tpopFunc();
}

var tpopFunc = function() {
	//Try to send first item in queue to AWS IoT
	if (tpopCommit == null) {
		messageQueue.tpop(function(err,message,commit,rollback) {
			tpopCommit = commit;
			tpopRollback = rollback;
		  	thingShadows.update(thingName,thingShadows);
		});
	}
}

exports.run = function(config) {
  	runConfig = config;

	emmiter = newPatterEmitter();

	awsThingShadow = newThingShadow(runConfig.IoTConfig, runConfig.shadow.state);

  	var GPSSource = listenForGPS(runConfig.GPSudpPort, emitter);
}


var listenForGPS = function(udpPort, patternEmitter) {}
	//Monitor GPS data from UDP
	var nmea = require("nmea");
	var dgram = require("dgram");
	var server = dgram.createSocket("udp4");

	server.on("error", function (err) {
	  console.log("server error:\n" + err.stack);
	  server.close();
	});

	server.on("listening", function () {
	  runConfig.myIP = server.address();
	});

	server.on("message", function (msg, rinfo) {
	  patternEmitter.emit("GPS.message",{message:String(msg)})
	});

	//GPS parsing and emitting
	patternEmitter.on("GPS\.message/", function(message) {
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

	patternEmitter.emit = function(event) {
		//other changes to the event before we emit it?

	  //publish emit
		console.log("Publishing " + event + " with " + arguments[1]);

		//local emit
		this.__emit(event, arguments);
	}
	return patternEmitter;
}

var newThingShadow = functon(config, state) {
	var thingName = config.thingName;
	var awsIot = require('aws-iot-device-sdk');
	//TODO Need to move client certificates into the config file
	var thingShadows = awsIot.thingShadow(config);
	var clientTokenUpdate;

	thingShadows.on('connect', function() {
	// After connecting to the AWS IoT platform, register interest in the
	// Thing Shadow.
		thingShadows.register(thingName);

	// 2 seconds after registering, update the Thing Shadow
	// with the latest device state and save the clientToken
	// so that we can correlate it with status or timeout events.
	//
	// Note that the delay is not required for subsequent updates; only
	// the first update after a Thing Shadow registration using default
	// parameters requires a delay.  See API documentation for the update
	// method for more details.
	//
	    setTimeout( function() {
	       clientTokenUpdate = thingShadows.update(thingName, state);
	       }, 2000 );
    });

	//Emmitted when an operation update|get|delete completes.
	thingShadows.on('status', function(thingName, stat, clientToken, stateObject) {
       	console.log('received '+stat+' on '+thingName+': '+ JSON.stringify(stateObject));
       	//call commit if works
       	tpopCommit(function(err) { if (err) throw err; });
       	//clear tpopCommit and tpopRollback
      	tpopCommit = null;
      	tpopRollback = null;
       	//Recurse until messageQueue is empty
       	tpopFunc();
    });

	//Emmitted when a delta has been received for a registered ThingShadow.
	thingShadows.on('delta', function(thingName, stateObject) {
       console.log('received delta '+' on '+thingName+': '+ JSON.stringify(stateObject));
    });

	//Emmitted when an operation update|get|delete has timed out.
	thingShadows.on('timeout', function(thingName, clientToken) {
       console.log('received timeout '+' on '+operation+': '+ clientToken);
      //Call rollback
      tpopRollback(function(err) { if (err) throw err; });
      //Clear tpopCommit and tpopRollback
      tpopCommit = null;
      tpopRollback = null;
    });

	return thingShadows;
}

var newQueue = function(thingShadow) {
	// https://www.npmjs.com/package/file-queue
	var Queue = require('file-queue').Queue,
    	queue = new Queue('./queue', function(err){console.log("error setting up queue: " + err);});
}