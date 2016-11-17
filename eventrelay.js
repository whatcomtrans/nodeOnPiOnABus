"use strict";

class eventRelay {

	constructor () {
		super();
		var _this = this;
		_this._logger = console;

          _this._emitters = new Map();
	}

	set logger(logger) {
		var _this = this;
		_this._logger = logger;
	}

	get logger() {
		var _this = this;
		return _this._logger;
	}

     addRelay(prefix, emitter) {
          var _this = this;
          _this._emmitters.set(prefix, emitter);
     }

     getRelay(prefix) {
          var _this = this;
          return _this._emitters.get(prefix);
     }

     on(eventName, listener) {
          var _this = this;
          var prefix = eventName.split(".", 1)[0];
          var eventName = eventName.split(".", 1)[1];
          _this._emitters.get(prefix).on(eventName, listener);
     }

     once(eventName, listener) {
          var _this = this;
          var prefix = eventName.split(".", 1)[0];
          var eventName = eventName.split(".", 1)[1];
          _this._emitters.get(prefix).once(eventName, listener);
     }
}
