"use strict";

// http://justbuildsomething.com/node-js-best-practices/
//callback = (typeof callback === 'function') ? callback : function() {};

/**
 * Requires...
 */
const EventEmitter = require('events');
// using https://www.npmjs.com/package/ping
const ping = require('ping');

/**
 * Defines an debugConsole class
 * @class
 */
class netmonitor extends EventEmitter {
    constructor(settings) {
        super();
        var _this = this;

        _this._logger = console;
        _this._monitored = [];

        // enumerations

        // Defaults
        if (settings === undefined) {
            _this._settings = new Object();
       } else {
            _this._settings = settings;
       }

    }

     ping(host) {
		ping.sys.probe(host, function(isAlive){
			var msg = isAlive ? 'host ' + host + ' is alive' : 'host ' + host + ' is dead';
			console.log(msg);
		});
     }

     monitor(config) {
         // Add the config passed (and set any defaults) to the array of objects to be monitored
         // TODO
     }

     get settings() {
          var _this = this;
          return _this._settings;
     }

     stop() {
          // TODO , if anything
     }

		set logger(logger) {
		var _this = this;
		_this._logger = logger;
	}

	get logger() {
		var _this = this;
		return _this._logger;
	}
}

module.exports.netmonitorFactory = function(settings) {
     return new netmonitor(settings);
}
