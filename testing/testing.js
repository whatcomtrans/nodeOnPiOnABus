var gpsStrings = [
"$GPRMC,202224.00,A,4847.22975,N,12226.97600,W,000.00,000.0,151215,17.1,E,D*2B",
"$GPGLL,4847.22976,N,12226.97600,W,202225.00,A,D*71",
"$GPGGA,202228.00,4847.22976,N,12226.97599,W,2,10,0.93,00052,M,-016,M,,*5A",
"$GPGSA,A,3,08,10,11,14,18,21,22,24,27,32,,,1.56,0.93,1.25*08",
"$GPGSV,3,1,11,08,38,267,40,10,68,065,43,11,23,308,42,14,67,168,40*77",
"$GPRMC,202229.00,A,4847.22977,N,12226.97599,W,000.00,000.0,151215,17.1,E,D*27",
"$GPRMC,202244.00,A,4847.22979,N,12226.97594,W,000.00,000.0,151215,17.1,E,D*2F",
];

var dgram = require('dgram');
var server = dgram.createSocket("udp4");
//server.bind();
//server.setBroadcast(true)
//server.setMulticastTTL(128);
//server.addMembership('127.0.0.1');

setInterval(broadcastNew, 3000);

function broadcastNew() {
    var message = new Buffer(gpsStrings[Math.floor(Math.random()*gpsStrings.length)]);
    server.send(message, 0, message.length, 5067, "192.168.1.15");
    console.log("Sent " + message + " to the wire...");
    //server.close();
}
