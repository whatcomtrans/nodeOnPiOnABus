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
          super();
          var _this = this;
     }

}

module.exports.consoleFactory = function(output, level) {
     return new debugConsole(output, level);
}
