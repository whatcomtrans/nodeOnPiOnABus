"use strict";

// http://justbuildsomething.com/node-js-best-practices/
//callback = (typeof callback === 'function') ? callback : function() {};

/**
 * Requires...
 */
const EventEmitter = require('events');

/**
 * Defines an alerter class
 * @class
 */
class alerter extends EventEmitter {
     constructor(settings) {
          super();
          var _this = this;

          // enumerations
          //
          // status
          _this.IMPORTANT = "IMPORTANT";
          _this.INFO = "INFO";
          _this.WARNING = "WARNING";
		_this.ERROR = "ERROR";

          // Defaults
          if (settings === undefined) {
               _this._settings = new Object();
          } else {
              _this._settings = settings;
          }

		  if (_this._logger === undefined) {
               _this._logger = console;
          }

          if (_this._settings.defaultStatus === undefined) {
               _this._settings.defaultStatus = _this.INFO;
          }

          if (_this._settings.defaultSource === undefined) {
               _this._settings.defaultSource = "unknownSource";
          }

          if (_this._settings.mqttTopic === undefined) {
               _this._settings.mqttTopic = null;
          }

		  if (_this._settings.vehicleId === undefined) {
               _this._settings.vehicleId = null;
          }
          _this._mqttAgent = null;
     }

     publishAlert(message, callback) {
        var _this = this;
        callback = (typeof callback === 'function') ? callback : function() {};

		if (typeof message === 'string') {
			var msg = message;
			message = new Object();
			message.message = msg;
		}
		if (message.source === undefined) {
        	message.source = _this._settings.defaultSource;
		}
		if (message.dateTime === undefined) {
        	message.dateTime = new Date();
		}
		if (message.vehicleId === undefined) {
			message.vehicleId = _this._settings.vehicleId;
        }
		if (message.status === undefined) {
			message.status = _this._settings.defaultStatus;
        }

        _this._logger.log("ALERT: " + JSON.stringify(message), _this._logger.INFO)
        if ((_this._settings.mqttTopic != null) & (_this._mqttAgent != null)) {
            _this._mqttAgent.publish(_this._settings.mqttTopic, JSON.stringify(message), function(err) {
                    if (err == null) {
                         _this.emit("alert.mqtt.success", message);
                    } else {
						_this._logger.log("ALERT: Error sending alert: " + JSON.stringify(message));
                        _this.emit("alert.mqtt.failed", message, err);
                    }
					callback;
               });
        }
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

     set mqttAgent (agent) {
          var _this = this;
          _this._mqttAgent = agent;
          _this.emit("changed.mqttAgent", _this._mqttAgent);
     }

     get mqttAgent () {
          var _this = this;
          return _this._mqttAgent;
     }

     set mqttTopic (topic) {
          var _this = this;
          _this._settings.mqttTopic = topic;
          _this.emit("changed.mqttTopic", _this._settings.mqttTopic);
          _this.emit("changed", "mqttTopic", _this._settings);
     }

     get mqttTopic () {
          var _this = this;
          return _this._settings.mqttTopic;
     }

	 set vehicleId (id) {
          var _this = this;
          _this._settings.vehicleId = id;
          _this.emit("changed.vehicleId", _this._settings.vehicleId);
          _this.emit("changed", "vehicleId", _this._settings);
     }

     get vehicleId () {
          var _this = this;
          return _this._settings.vehicleId;
     }

	 set defaultStatus (status) {
          var _this = this;
          _this._settings.defaultStatus = status;
          _this.emit("changed.defaultStatus", _this._settings.defaultStatus);
          _this.emit("changed", "defaultStatus", _this._settings);
     }

     get defaultStatus () {
          var _this = this;
          return _this._settings.defaultStatus;
     }

     set defaultSource (source) {
          var _this = this;
          _this._settings.defaultSource = source;
          _this.emit("changed.defaultSource", _this._settings.defaultSource);
          _this.emit("changed", "defaultSource", _this._settings);
     }

     get defaultSource () {
          var _this = this;
          return _this._settings.defaultSource;
     }
}

module.exports.alerterFactory = function(settings) {
     return new alerter(settings);
}
