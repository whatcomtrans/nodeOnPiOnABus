"use strict";

const dgram = require("dgram");
const net = require('net');
const GPSclass = require(gps);

class gpsDevice extends GPSClass{
	const net = require('net');
	constructor () {
		this.super();
		var _this = this;
		_this._logger = console;
		_this._source = "";
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
		switch (config.source) {
			"udp" :
				_listenUDP(config.udpPort);
				break;
		}
	}

	_listenUDP(port) {
		var _this = this;
		var server = dgram.createSocket("udp4");
		_this._logger.log("Listing on UDP port " + udpPort);
		server.on("error", function (err) {
			_this._logger.log("server error:\n" + err.stack, debugConsole.IMPORTANT);
			server.close();
		});
		server.on("listening", function () {
			//this.myIP = server.address();
			_this._logger.log("Server is listening for udp packets...");
			_this.emit("listening");
		});
		server.on("message", function (msg, rinfo) {
			var gpsString = String(msg);
			_this._logger.log("Server received message: " + gpsString);
			_this._logger.emit("rawdata", gpsString);
			_this.update(gpsString);
			_this.emit("message." + _this.type, gpsString);
		});

		//GPS parsing and emitting
		_this._logger.log("Binding to port " + udpPort);
		server.bind(udpPort);
		_this._server = server;
		_this._source = "udp";
	}

	stop() {
		var _this = this;
		switch (_this._source) {
			case "udp":
				_this._server.close();
				break;
		}
	}
}

modele.exports.gpsFactory = function() {
	return new gpsDevice();
}
