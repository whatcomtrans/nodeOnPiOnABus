"use strict";

const dgram = require("dgram");
const net = require('net');
const GPS = require('gps');
const EventEmitter = require('events');

class gpsDevice extends EventEmitter {

	constructor () {
		super();
		var _this = this;
		_this._logger = console;
		_this._source = "";
		//_this._parser = new GPS;
		_this.state = null;
	}

	set logger(logger) {
		var _this = this;
		_this._logger = logger;
	}

	get logger() {
		var _this = this;
		return _this._logger;
	}

	listen(config) {
		var _this = this;
		switch (config.source) {
			case "udp":
				_this._listenUDP(config.udpPort);
				break;
		}
	}

	_listenUDP(port) {
		var _this = this;
		var server = dgram.createSocket("udp4");
		_this._logger.log("Listening on UDP port " + port);
		server.on("error", function (err) {
			_this._logger.log("server error:\n" + err.stack);
			server.close();
		});
		server.on("listening", function () {
			//this.myIP = server.address();
			_this._logger.log("Server is listening for udp packets...");
			_this.emit("listening");
		});
		server.on("message", function (msg, rinfo) {
			var gpsString = String(msg);
			// _this._logger.log("Server received message: " + gpsString);
			_this.emit("rawdata", gpsString);
			var result = GPS.Parse(gpsString);
			_this.state = result;
			_this.emit(result.type, result);
			_this.emit("data", result);
		});

		//GPS parsing and emitting
		_this._logger.log("Binding to port " + port);
		server.bind(port);
		_this._server = server;
		_this._source = "udp";
	}

	stop(callback) {
		var _this = this;
		callback = (typeof callback === 'function') ? callback : function(error) {};
		switch (_this._source) {
			case "udp":
				_this._server.unref();
				_this._server.close(callback);
				break;
		}
	}

	Distance(latFrom, lonFrom, latTo, lonTo) {
		return GPS.Distance(latFrom, lonFrom, latTo, lonTo);
	}

	Heading(latFrom, lonFrom, latTo, lonTo) {
		return GPS.Heading(latFrom, lonFrom, latTo, lonTo)
	}

	Parse(line) {
		return GPS.Parse(line)
	}
}

module.exports.gpsFactory = function() {
	return new gpsDevice();
}
