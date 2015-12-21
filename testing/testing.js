var gpsStrings = [
"$GPGGA,202223.00,4847.22975,N,12226.97600,W,2,10,0.93,00052,M,-016,M,,*51",
"$GPGSA,A,3,08,10,11,14,18,21,22,24,27,32,,,1.56,0.93,1.25*08",
"$GPGSV,3,1,11,08,38,267,39,10,68,065,43,11,23,308,43,14,67,168,41*79",
"$GPGSV,3,2,11,18,36,083,42,21,14,137,32,22,81,053,42,24,24,056,39*7B",
"$GPGSV,3,3,11,27,31,227,42,32,18,265,38,48,33,194,39,,,,*47",
"$GPRMC,202224.00,A,4847.22975,N,12226.97600,W,000.00,000.0,151215,17.1,E,D*2B",
"$GPGLL,4847.22976,N,12226.97600,W,202225.00,A,D*71",
"$GPGGA,202228.00,4847.22976,N,12226.97599,W,2,10,0.93,00052,M,-016,M,,*5A",
"$GPGSA,A,3,08,10,11,14,18,21,22,24,27,32,,,1.56,0.93,1.25*08",
"$GPGSV,3,1,11,08,38,267,40,10,68,065,43,11,23,308,42,14,67,168,40*77",
"$GPGSV,3,2,11,18,36,083,41,21,14,137,32,22,81,053,42,24,24,056,39*78",
"$GPGSV,3,3,11,27,31,227,42,32,18,265,39,48,33,194,39,,,,*46",
"$GPRMC,202229.00,A,4847.22977,N,12226.97599,W,000.00,000.0,151215,17.1,E,D*27",
"$GPGLL,4847.22977,N,12226.97599,W,202230.00,A,D*77",
"$GPGSA,A,3,08,10,11,14,18,21,22,24,27,32,,,1.56,0.93,1.25*08",
"$GPGLL,4847.22978,N,12226.97597,W,202235.00,A,D*73",
"$GPGGA,202238.00,4847.22978,N,12226.97596,W,2,10,0.93,00052,M,-016,M,,*5A",
"$GPGSV,3,1,11,08,38,267,40,10,68,065,44,11,23,308,42,14,67,168,40*70",
"$GPGSV,3,3,11,27,31,227,42,32,18,265,39,48,33,194,39,,,,*46",
"$GPGSA,A,3,08,10,11,14,18,21,22,24,27,32,,,1.56,0.93,1.25*08",
"$GPGLL,4847.22979,N,12226.97595,W,202241.00,A,D*73",
"$GPGGA,202243.00,4847.22979,N,12226.97595,W,2,10,0.93,00052,M,-016,M,,*54",
"$GPGSV,3,1,11,08,38,267,41,10,68,065,44,11,23,308,42,14,67,168,40*71",
"$GPGSV,3,2,11,18,36,083,41,21,14,137,32,22,81,053,42,24,24,056,40*76",
"$GPRMC,202244.00,A,4847.22979,N,12226.97594,W,000.00,000.0,151215,17.1,E,D*2F",
"$GPGSA,A,3,08,10,11,14,18,21,22,24,27,32,,,1.56,0.93,1.25*08",
"$GPGLL,4847.22980,N,12226.97594,W,202246.00,A,D*73"
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
    server.send(message, 0, message.length, 5067, "127.0.0.1");
    console.log("Sent " + message + " to the wire...");
    //server.close();
}
