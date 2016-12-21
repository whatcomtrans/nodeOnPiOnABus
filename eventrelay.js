"use strict";

const EventEmitter = require('events');

class eventRelay {

	constructor () {
    	//super();
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
          
          // Update the emitter to expect a lot more requests
          if (emitter.getMaxListeners() == EventEmitter.defaultMaxListeners) {
            emitter.setMaxListeners(EventEmitter.defaultMaxListeners * 10);
          }

          _this._emitters.set(prefix, emitter);
          _this._logger.log("Adding emitter as " + prefix);

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
          var prefix = eventName.split(".", 2)[0];
          var localEventName = eventName.split(".", 2)[1];
          _this._logger.log("Recieved ON for prefix " + prefix + " with event name " + localEventName);
          if (_this._emitters.has(prefix)) {
               _this._emitters.get(prefix).on(localEventName, listener);
          } else {
               _this.addWaiting(eventName, listener, false);
          }
     }

     once(eventName, listener) {
          var _this = this;
          var prefix = eventName.split(".", 2)[0];
          var localEventName = eventName.split(".", 2)[1];
          _this._logger.log("Recieved ONCE for prefix " + prefix + " with event name " + localEventName);
          if (_this._emitters.has(prefix)) {
               _this._emitters.get(prefix).once(localEventName, listener);
          } else {
               _this.addWaiting(eventName, listener, true);
          }
     }

     every(eventName, listener, tracker) {
          var _thisRelay = this;
          // create a in between callback which intercepts the callback and only calls listener bases on rules of the tracker properties
          if (tracker === undefined) {  // Treat as on
			_thisRelay._logger.log("No tracker passed to every method");
               _thisRelay.on(eventName, listener);
          } else {
			_thisRelay._logger.log("Adding custom listener with tracker of method: " + tracker.method);
               _thisRelay.on(eventName, function() {
                    var _this = this;
                    var _thisTracker = tracker;
                    var _theRelay = _thisRelay;
				// _theRelay._logger.log("Callback called, processing 'every' tracker");
                    // TODO
                    // Buid out a set of if syatememts that use the tracker
                    switch (_thisTracker.method) {
					case 'counter':
						// _theRelay._logger.log("In 'every' tracker of method 'counter', count = " + _thisTracker.count + ", currentCount = " + _thisTracker.currentCount);
						if (_thisTracker.currentCount === undefined) {
							_thisTracker.currentCount = 1;
							// _theRelay._logger.log("In 'every' tracker of method 'counter', count = " + _thisTracker.count + ", currentCount NOW = " + _thisTracker.currentCount);
						}
						if (_thisTracker.currentCount < _thisTracker.count) {
							_thisTracker.currentCount = _thisTracker.currentCount + 1;
						} else {
							listener.apply(_this, arguments);
							_thisTracker.currentCount = 0;
						}
						break;
					case "timer":
						var currentTime = (new Date()).valueOf();
						// _theRelay._logger.log("In 'every' tracker of method 'timer', delay = " + _thisTracker.delay + ", lastTime = " + _thisTracker.lastTime + ", currentTime = " + currentTime);
						if (_thisTracker.lastTime === undefined) {
							_thisTracker.lastTime = currentTime;
							// _theRelay._logger.log("In 'every' tracker of method 'timer', delay = " + _thisTracker.delay + ", lastTime = " + _thisTracker.lastTime + ", currentTime NOW = " + currentTime);
						}
						if (currentTime < (_thisTracker.lastTime + _thisTracker.delay)) {
							// Do nothing
						} else {
							listener.apply(_this, arguments);
							_thisTracker.lastTime = currentTime;
						}
						break;
					default:
						listener.apply(_this, arguments);
						break;
				}
               });
          }
      }

     addWaiting(eventName, listener, once) {
          var _this = this;
          var prefix = eventName.split(".", 2)[0];
          var localEventName = eventName.split(".", 2)[1];

          if (_this._waitingEmitters.has(prefix)) {
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
}

module.exports.relayFactory = function () {
     return new eventRelay();
}
