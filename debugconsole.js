"use strict";

// http://justbuildsomething.com/node-js-best-practices/
//callback = (typeof callback === 'function') ? callback : function() {};

/**
 * Requires...
 */
const EventEmitter = require('events');

/**
 * Defines an debugConsole class
 * @class
 */
class debugConsole extends EventEmitter {
     constructor(output, level) {
          var _this = this;
          super();

          // enumerations
          //
          // level
          _this.IMPORTANT = 1;
          _this.INFO = 2;
          _this.DEBUG = 3

          // output
          _this.CONSOLEONLY = "CONSOLEONLY";
          _this.CONSOLEMQTT = "CONSOLEMQTT";
          _this.MQTTONLY = "MQTTONLY";
          _this.NONE = "NONE";

          // Defaults
          if (output === undefined) {
               _this._debugOutput = _this.CONSOLEONLY;
          } else {
               _this._debugOutput = output;
          }

          if (level === undefined) {
               _this._debugLevel = _this.INFO;
          } else {
               _this._debugLevel = level;
          }

          _this._mqttTopic = null;
          _this._mqttAgent = null;
     }

     log (message, level, debugOutput) {
          var _this = this;
          if (level  === undefined) {
               level = _this._debugLevel;
          }
          if (debugOutput === undefined) {
               debugOutput = _this._debugOutput;
          }
          var levelName = "DEBUG";
          if (level <= debugLevel) {
               switch (level) {
                    case 1:
                         levelName = "IMPORTANT";
                         break;
                    case 2:
                         levelName = "INFO";
                         break;
                    case 3:
                         levelName = "DEBUG";
                         break;
               }
               var msg = levelName + ": " + message;
               _this.emit("logged", msg, message, level, levelName, debugOutput)
               switch (debugOutput) {
                    case _this.CONSOLEONLY:
                         console.log(msg);
                         break;
                    case _this.MQTTONLY:
                         _this.logMqtt(msg);
                         break;
                    case _this.CONSOLEMQTT:
                         console.log(msg);
                         _this.logMqtt(msg);
                         break;
                    case _this.NONE:
                         break;
                    default:
                         // None
                         break;
               }
          }
     }

     logMqtt(msg) {
          var _this = this;
          if (_this._mqttTopic == null || _this._mqttAgent == null) {
               _this.emit("logged.mqtt.failed", msg, "Either topic or agent are null.")
          } else {
               _this._mqttAgent.publish(_this._mqttTopic, msg, function(err) {
                    if (err == null) {
                         _this.emit("logged.mqtt.success", msg);
                    } else {
                         _this.emit("logged.mqtt.failed", msg, err);
                    }
               });
          }
     }

     set debugOutput (output) {
          var _this = this;
          _this._debugOutput = output.toUpperCase();
          _this.emit("changed.debugOutput", _this._debugOutput);
          _this.emit("changed", "debugOutput", _this._debugOutput);
     }

     get debugOutput () {
          var _this = this;
          return _this._debugOutput;
     }

     set debugLevel (level) {
          var _this = this;
          if (parseInt(level, 10) == NaN) {
               switch (level.toUpperCase()) {
                    case _this.IMPORTANT:
                         level = _this.IMPORTANT;
                         break;
                    case _this.INFO:
                         level = _this.INFO;
                         break;
                    case _this.DEBUG:
                         level = _this.DEBUG;
                         break;
                    default:
                         level = _this.DEBUG;
                         break;
               }
          } else (
               level = parseInt(level, 10);
          )
          _this._debugLevel = level;
          _this.emit("changed.debugLevel", _this._debugLevel);
          _this.emit("changed", "debugLevel", _this._debugLevel);
     }

     get debugLevel () {
          var _this = this;
          return _this._debugLevel;
     }

     set mqttAgent (agent) {
          var _this = this;
          _this._mqttAgent = agent;
          _this.emit("changed.mqttAgent", _this._mqttAgent);
          _this.emit("changed", "mqttAgent", _this._mqttAgent);
     }

     get mqttAgent () {
          var _this = this;
          return _this._mqttAgent;
     }

     set mqttTopic (topic) {
          var _this = this;
          _this._mqttTopic = topic;
          _this.emit("changed.mqttTopic", _this._mqttTopic);
          _this.emit("changed", "mqttTopic", _this._mqttTopic);
     }

     get mqttTopic () {
          var _this = this;
          return _this._mqttTopic;
     }
}

module.exports.consoleFactory = function(output, level) {
     return new debugConsole(output, level);
}
