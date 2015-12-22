//Global Objects
/*var runConfig;
var emitter;

var myThingShadow;
*/
/*
var awsThingShadow;
var messageQueue;
var tpopCommit = null;
var tpopRollback = null;

var updateState = function () {
	//Add status to end of queue
  	messageQueue.push(runConfig.shadow, function(err){
      if (err != undefined) {
      	//Attempt to send directly to AWS then exit
      	awsThingShadow.update(runConfig.IoTConfig.thingName,runConfig.shadow);
      	process.exit(0);
      }
  	});
  	tpopFunc();
}

var tpopFunc = function() {
	//Try to send first item in queue to AWS IoT
	if (tpopCommit == null) {
		messageQueue.tpop(function(err,message,commit,rollback) {
			tpopCommit = commit;
			tpopRollback = rollback;
		  	awsThingShadow.update(runConfig.IoTConfig.thingName,runConfig.shadow);
		});
	}
}
*/
exports.run = function(config) {
  //runConfig = config;

	emitter = newPatternEmitter();

  /*
  messageQueue = newQueue();
	awsThingShadow = newThingShadow(runConfig.IoTConfig, runConfig.shadow);
  */
  //var GPSSource = listenForGPS(runConfig.GPSudpPort, emitter);
  var GPSSource = listenForGPS(config.GPSudpPort, emitter);
  var myThingShadow = createThingShadow(config.IoTConfig, config.shadow, config.queuePath);

  emitter.on("GPS.GPRMC", function(eventObject) {
    myThingShadow.setStateReportedValue("latitude", eventObject.lat, false);
    myThingShadow.setStateReportedValue("longitude", eventObject.lon, true);
  });
}

var listenForGPS = function(udpPort, patternEmitter) {
	//Monitor GPS data from UDP
	var nmea = require("nmea");
	var dgram = require("dgram");
	var server = dgram.createSocket("udp4");

	server.on("error", function (err) {
	  console.log("server error:\n" + err.stack);
	  server.close();
	});

	server.on("listening", function () {
	  //this.myIP = server.address();
	});

	server.on("message", function (msg, rinfo) {
    var gpsMessage = new Object();
    gpsMessage.message = String(msg);
	  patternEmitter.emit("GPS.message", gpsMessage);
	});

	//GPS parsing and emitting
	patternEmitter.on("GPS.message", function(message) {
    //console.log(JSON.stringify(message));
	 	var msgString = message.message;
    //console.log("The msgString is: " + msgString);
		if (msgString.indexOf("$GPRMC") > -1) {
	  		var sentence = nmea.parse(msgString);
		    sentence.lat = sentence.lat.substring(0,2) + '.' + (sentence.lat.substring(2)/60).toString().replace('.','');
		    sentence.lon = '-' + sentence.lon.substring(0,3) + '.' + (sentence.lon.substring(3)/60).toString().replace('.','');
		    patternEmitter.emit("GPS.GPRMC",sentence);
		    //Set the lat/long value and update timestamp on myconfig
		    //runConfig.shadow.state.reported.latitude = sentence.lat;
  			//runConfig.shadow.state.reported.longitude = sentence.lon;
  			//runConfig.shadow.state.reported.updated = Math.floor(new Date() / 1000);
        //console.log(JSON.stringify(runConfig));
  			//updateState();
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

	/*patternEmitter.emit = function(event) {
		//other changes to the event before we emit it?

	  //publish emit
		console.log("Publishing " + event + " with " + JSON.stringify(arguments[1]));

		//local emit
		this.__emit(event, arguments);
	}*/
	return patternEmitter;
}

var createThingShadow = function(AWSShadowConfig, initialState, queuePath) {

	var awsIot = require('aws-iot-device-sdk');
  var Queue = require('file-queue').Queue;
	//TODO Need to move client certificates into the config file
  //TODO Handle re-registering after long disconnected states
	var thisShadow = awsIot.thingShadow(AWSShadowConfig);
  thisShadow.thingName = AWSShadowConfig.thingName;
	thisShadow.lastClientTokenUpdate = null;
  thisShadow.stateCurrent = initialState.state.reported;

  //These functions will be overridden to support the queue
  thisShadow._update = thisShadow.update;
  thisShadow._pulish = thisShadow.publish;

  //Setup queue
  //TODO add support for multiple things by using seperate paths
  thisShadow._queue = new Queue(queuePath, function(err){if (err != undefined) {console.log("error setting up queue: " + err);}});

  thisShadow._sendQueue = function() {
  	//Try to send first item in queue to AWS IoT, but only if nothing pending and status is ready is true
    console.log("In _sendQueue");
  	if (this._tpopCommit == null && this.ready) {
      console.log("About to tpop");
  		this._queue.tpop(function(err,message,commit,rollback) {
        if (err == undefined) {
          console.log("Have message " + JSON.stringify(message));
    			this._tpopCommit = commit;
    			this._tpopRollback = rollback;
          if (message.type == "update") {
            console.log("Attempting AWS update with " + JSON.stringify(message.content));
            this._update(this.thingName, message.content);
          } elseif (message.type == "publish")
    		  this._publish(this.thingName,this.content);
        } else {
          console.log("error in tpop " + err)
          //Process bad messages TODO
          this._tpopCommit = commit;
        }
  		});
  	}
  }

  thisShadow.update = function(stateObject) {
    if (stateObject != undefined) {
      this.stateCurrent = stateObject.state.reported;
    }
    //build clean state document
    var stateDocument = new Object();
    stateDocument.state = new Object();
    stateDocument.state.reported = this.stateCurrent;
    //Build message to include type and content
    var message = new Object();
    message.type = "update";
    message.content = stateDocument;
    console.log("Pushing " + JSON.stringify(message) + " to queue...");
    this._queue.push(message);  //TODO add error handling
    //Attempt to send now
    this._sendQueue();
  }

  //TODO build new publish function

  thisShadow.setStateReportedValue = function(name, value, updateNow) {
    console.log(JSON.stringify(this.stateCurrent));
    console.log("set " + name + " to " + value);
    this.stateCurrent[name] = value;
    if (updateNow) {
      this.stateCurrent.updated = Math.floor(new Date() / 1000);
      this.update();
    }
  }

  thisShadow.on('connect', function() {
		thisShadow.register(thisShadow.thingName);
    thisShadow.ready = false;
    setTimeout( function() {
      //waited 2 seconds
      thisShadow.ready = true;
      thisShadow.update();
      }, 2000 );
    });

  thisShadow.on('status', function(thingName, stat, clientToken, stateObject) {
    console.log('received '+stat+' on '+thingName+': '+ JSON.stringify(stateObject));
    thisShadow.ready = true;
    thisShadow.lastStatus = stat;
    //TODO only update the following based on certain stat values
    thisShadow.stateReported = stateObject.state.reported;
    thisShadow.stateDesired = stateObject.state.desired;

    if (thisShadow._tpopCommit != null) {
      //call commit if works
      thisShadow._tpopCommit(function(err) { if (err) throw err; });
      //clear tpopCommit and tpopRollback
      thisShadow._tpopCommit = null;
      thisShadow._tpopRollback = null;
      //Recurse until messageQueue is empty
      thisShadow._sendQueue();
    }
  });

	//Emmitted when a delta has been received for a registered ThingShadow.
	thisShadow.on('delta', function(thingName, stateObject) {
     console.log('received delta '+' on '+thingName+': '+ JSON.stringify(stateObject));
  });

	//Emmitted when an operation update|get|delete has timed out.
	thisShadow.on('timeout', function(thingName, clientToken) {
    //TODO should we set ready to false here?
    console.log('received timeout '+' on '+operation+': '+ clientToken);
    if (thisShadow._tpopCommit != null) {
      //Call rollback
      thisShadow._tpopRollback(function(err) { if (err) throw err; });
      //Clear tpopCommit and tpopRollback
      thisShadow._tpopCommit = null;
      thisShadow._tpopRollback = null;
    }
  });

  return thisShadow;
}




/*



var newThingShadow = function(config, state) {
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
        if (tpopCommit != null) {
          //call commit if works
          tpopCommit(function(err) { if (err) throw err; });
          //clear tpopCommit and tpopRollback
          tpopCommit = null;
          tpopRollback = null;
          //Recurse until messageQueue is empty
          tpopFunc();
        }
    });

	//Emmitted when a delta has been received for a registered ThingShadow.
	thingShadows.on('delta', function(thingName, stateObject) {
       console.log('received delta '+' on '+thingName+': '+ JSON.stringify(stateObject));
    });

	//Emmitted when an operation update|get|delete has timed out.
	thingShadows.on('timeout', function(thingName, clientToken) {
       console.log('received timeout '+' on '+operation+': '+ clientToken);
       if (tpopCommit != null) {
         //Call rollback
         tpopRollback(function(err) { if (err) throw err; });
         //Clear tpopCommit and tpopRollback
         tpopCommit = null;
         tpopRollback = null;
       }
    });

	return thingShadows;
}

var newQueue = function(thingShadow) {
	// https://www.npmjs.com/package/file-queue
	var Queue = require('file-queue').Queue,
      queue = new Queue('./queue', function(err){if (err != undefined) {console.log("error setting up queue: " + err);}});
  return queue;
}
*/
