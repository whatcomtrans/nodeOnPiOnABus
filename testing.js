module.exports.run = function(config) {
  var Queue = require('file-queue').Queue;
  var q = new Queue(config.queuePath, function(err){if (err != undefined) {console.log("error setting up queue: " + err);}});
}
