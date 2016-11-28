"use strict";

const fs = require('fs');
const jsonfile = require('jsonfile');
const EventEmitter = require('events');

module.exports = class thingSettings extends EventEmitter {
     constructor (fileName, initialSettings) {
          super();
          var _this = this;
          _this.defaultDelayUpdate = false;

          _this._delta = new Object();
          _this._reported = new Object();
          _this._desired = new Object();

          if (fileName === undefined) {
               _this._fileName = null;
          } else {
               _this._fileName = filename;
          }

          if (initialSettings === undefined) {
               _this._local = new Object();
          } else {
               _this._local = initialSettings;
          }

          if (_this._fileName != null) {
               if (fs.existsSync(_this._fileName)) {
                    _this._settings.apply(require(_this._fileName));
               }
          }
     }

     get connected() {
          return false;
     }

     get reconnecting() {
          return false;
     }

     // Method for updating properties/settings
     reportProperty(propertyName, propertyValue, delayUpdate, callback) {
          var _this = this;
          //debugConsole(JSON.stringify(_this._local));
          callback = (typeof callback === 'function') ? callback : function() {};
          var oldValue = null;
          var isAdded = false;

          //Update local property
          if (_this.hasOwnProperty(propertyName) == false) {
               //debugConsole("Property " + propertyName + " does not exist in _local, adding it now.")
               //create it first
               if (_this._local.hasOwnProperty(propertyName) == false) {
                    _this._local[propertyName] = propertyValue;
               }
               ////debugConsole("Property added, _local is now " + JSON.stringify(_this._local));
               Object.defineProperty(_this, propertyName, {
                    "configurable": true,
                    "enumarable": true,
                    "get": function() {
                         return _this.getProperty(propertyName);
                    },
                    "set": function(value) {
                         _this.setProperty(propertyName, value);
                         _this.reportState();
                    }
               });
               isAdded = true;
               _this.emit(propertyName + "Added", propertyValue);
          } else {
               oldValue = _this._local[propertyName];
          }

          //Only update value if it is different
          ////debugConsole("Here with " + propertyName + " of value " + JSON.stringify(propertyValue) + " and old propertyValue of " + JSON.stringify(oldValue));
          if (equal(oldValue, propertyValue, {"strict": true})) {     //samve value
               //debugConsole("No value change");
          } else {       //New value
               //debugConsole("New property value, current _local is " + JSON.stringify(_this._local));
               _this._local[propertyName] = propertyValue;
               if (isAdded == false) {  //Fire added or changed but not both
                    //debugConsole("About to fire event " + propertyName + "Changed");
                    _this.emit(propertyName + "Changed", propertyValue, oldValue);
               }
               if (delayUpdate || _this.defaultDelayUpdate) {
                    //DO nothing
               } else {
                    ////debugConsole("Here, about to reportState" + JSON.stringify(_this._local));
                    _this.reportState(callback);
               }
          }
     }

     deleteProperty(propertyName, delayUpdate, callback) {
          var _this = this;
          var oldValue = _this[propertyName]
          delete _this[propertyName];
          delete _this._local[propertyName];
          _this.emit(propertyName + "Deleted", oldValue)
          if (delayUpdate != true) {
               _this.reportState(callback);
          }
     }

     setProperty(propertyName, propertyValue) {
          var _this = this;
          _this.reportProperty(propertyName, propertyValue);
     }

     getProperty(propertyName) {
          var _this = this;
          if (_this._local.hasOwnProperty(propertyName)) {
               return this._local[propertyName];
          } else {
               return null;
          }
     }

     reportState(callback) {
          callback();
     }

     retrieveState(callback) {
          callback();
     }

     getDesiredProperty(propertyName) {
          var _this = this;
          if (_this._desired === undefined) {
               return null;
          } else {
               if (_this._desired.hasOwnProperty(propertyName)) {
                    return this._desired[propertyName];
               } else {
                    return null;
               }
          }
     }

     getDesired() {
          return this._desired;
     }

     getDelta() {
          return this._delta;
     }

     getReported() {
          return this._reported;
     }

     getDeltaProperty(propertyName) {
          var _this = this;
          if (_this._delta === undefined) {
               return null;
          } else {
               if (_this._delta.hasOwnProperty(propertyName)) {
                    return this._delta[propertyName];
               } else {
                    return null;
               }
          }
     }

     end(force, callback) {
          callback();
     }

     writeSettings(callback) {
          // save the _local to _fileName
          var _this = this;
          jsonfile.writeFile(_this._fileName, _this._local, function (err) {
               callback(err);
          });
     }

     copyTo(obj, onlyProps) {
          // copy _local to thing reportProperty(propertyName, propertyValue, true)
          var _this = this;

          Object.getOwnPropertyNames(_this._local).forEach(function(propertyName, idx, array) {
               obj.reportProperty(propertyName, _this._local[propertyName], true);
          });
          if (onlyProps === undefined) {
               onlyProps = false;
          }

          if (onlyProps == false) {
               obj.writeSettings = function(callback) {
                    // save the _local to _fileName
                    var _this = this;
                    jsonfile.writeFile(_this._fileName, _this._local, function (err) {
                         callback(err);
                    });
               };
               obj.copyTo = function(obj, onlyProps) {
                    var _this = this;

                    Object.getOwnPropertyNames(_this._local).forEach(function(propertyName, idx, array) {
                         obj.reportProperty(propertyName, _this._local[propertyName], true);
                    });
                    if (onlyProps === undefined) {
                         onlyProps = false;
                    }

                    if (onlyProps == false) {
                         obj.writeSettings = function(callback) {
                              // save the _local to _fileName
                              var _this = this;
                              jsonfile.writeFile(_this._fileName, _this._local, function (err) {
                                   callback(err);
                              });
                         };
                         obj.copyTo = function(obj, onlyProps) {

                         }
                         obj._fileName = _this._fileName;
                    }

                    return obj;
               }
               obj._fileName = _this._fileName;
          }

          return obj;
     }

}
