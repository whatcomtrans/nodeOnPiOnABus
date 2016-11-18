"use strict";

class eventRelay {

	constructor () {
		super();
		var _this = this;
		_this._logger = console;

          _this._emitters = new Map();
          _this._waitingEmitters = new Map();

	}

	set logger(logger) {
		var _this = this;
		_this._logger = logger;
	}

	get logger() {
		var _this = this;
		return _this._logger;
	}

     addEmitter(prefix, emitter) {
          var _this = this;
          _this._emmitters.set(prefix, emitter);

          // If there are any waiting listeners, add them now
          if (_this._waitingEmitters.has(prefix)) {
               var waiting  = _this._waitingEmitters.get(prefix);
               var waitingListener = waiting.listeners.pop();
               while (waitingListener !==  undefined) {
                    if (waitingListener.once) {
                         // Add an once listener
                         emitter.once(waitingListener.localEventName, waitingListener.listener);
                    } else {
                         // Add an on listener
                         emitter.on(waitingListener.localEventName, waitingListener.listener);
                    }
                    // Get the next one
                    waitingListener = waiting.listeners.pop();
               }
               // Remove it from the list of waiting
               _this._waitingEmitters.delete(prefix);
          }
     }

     getEmitter(prefix) {
          var _this = this;
          return _this._emitters.get(prefix);
     }

     hasEmitter(prefix) {
          var _this = this;
          return _this._emitters.has(prefix);
     }

     on(eventName, listener) {
          var _this = this;
          var prefix = eventName.split(".", 1)[0];
          var localEventName = eventName.split(".", 1)[1];
          if (_this._emitters.has(prefix)) {
               _this._emitters.get(prefix).on(localEventName, listener);
          } else {
               _this.addWaiting(eventName, listener, false);
          }
     }

     once(eventName, listener) {
          var _this = this;
          var prefix = eventName.split(".", 1)[0];
          var localEventName = eventName.split(".", 1)[1];
          if (_this._emitters.has(prefix)) {
               _this._emitters.get(prefix).once(localEventName, listener);
          } else {
               _this.addWaiting(eventName, listener, true);
          }
     }

     addWaiting(eventName, listener, once) {
          var _this = this;
          var prefix = eventName.split(".", 1)[0];
          var localEventName = eventName.split(".", 1)[1];

          if ((_this._waitingEmitters.has(prefix)) {
               // Add to existing emitter waiting object
               var waiting = _this._waitingEmitters.get(prefix);
          } else {
               // Create new emitter waiting object
               var waiting = new Object();
               waiting.prefix = prefix;
               waiting.listeners = new Array();
               _this._waitingEmitters.set(prefix, waiting);
          }

          var waitingListener = new Object();
          waitingListener.prefix = prefix;
          waitingListener.eventName = eventName;
          waitingListener.localEventName = localEventName;
          waitingListener.listener = listener;
          waitingListener.once = false;
          waiting.listeners.push(waitingListener);
     }

	stop() {
		var _this = this;
		// TODO
	}
}

module.exports.relayFactory = function () {
     return new eventRelay();
}
