var runConfig;

//START:  Global Emmittor setup
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
//END

//START:  AWS IoT Setup
//TODO
var awsIot = require('aws-iot-device-sdk');

//TODO Need to move client certificates into the config file

var thingShadows = awsIot.thingShadow(runConfig.IoTConfig);
//Sample CODE follows, partially converted, see
// https://github.com/aws/aws-iot-device-sdk-js/blob/master/README.md#examples

//
// Thing shadow state
//
var shadow = runConfig.shadow;
var thingName = runConfig.IoTConfig.thingName;

//
// Client token value returned from thingShadows.update() operation
//
var clientTokenUpdate;

thingShadows.on('connect', function() {
//
// After connecting to the AWS IoT platform, register interest in the
// Thing Shadow.
//
    thingShadows.register(thingName);
//
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
       clientTokenUpdate = thingShadows.update(thingName, shadow  );
       }, 2000 );
    });

thingShadows.on('status',
    function(thingName, stat, clientToken, stateObject) {
       console.log('received '+stat+' on '+thingName+': '+
                   JSON.stringify(stateObject));
    });

thingShadows.on('delta',
    function(thingName, stateObject) {
       console.log('received delta '+' on '+thingName+': '+
                   JSON.stringify(stateObject));
    });

thingShadows.on('timeout',
    function(thingName, clientToken) {
       console.log('received timeout '+' on '+operation+': '+
                   clientToken);
    });

//END

//START:  Message queue to disk setup
//TODO
//END

//START: Process GPS events
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
    sentence.lat = sentence.lat / 100;
    sentence.lon = sentence.lon / 100 * -1;
    patternEmitter.emit("GPS.GPRMC",sentence);
  }
  if (msgString.indexOf("$GPGSV") > -1) {
  	var sentence = nmea.parse(msgString);
    patternEmitter.emit("GPS.GPGSV",sentence);
  }
  if (msgString.indexOf("$GPGGA") > -1) {
  	var sentence = nmea.parse(msgString);
    sentence.lat = sentence.lat / 100;
    sentence.lon = sentence.lon / 100 * -1;
    patternEmitter.emit("GPS.GPGGA",sentence);
  }
});
//END

exports.run = function(config) {
  runConfig = config;
  patternEmitter.emit("Test", "Hello World");

  server.bind(runConfig.GPSudpPort);
}
