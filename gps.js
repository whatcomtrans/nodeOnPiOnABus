const GPSclass = require(gps);

class gpsDevice extends GPSClass{
	constructor () {
    	this.super();
        var _this = this;
    }
    
    function listenUDP (port) {
    	var _this = this;
        
        // cut and paste udp code 
    }    
}

modele.exports.gpsFactory = function() {
	return new gpsDevice();
}