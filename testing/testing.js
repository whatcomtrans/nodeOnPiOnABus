var news = [
﻿
];

var dgram = require('dgram'); 
var server = dgram.createSocket("udp4"); 
server.bind();
server.setBroadcast(true)
server.setMulticastTTL(128);
server.addMembership('127.0.0.1'); 

setInterval(broadcastNew, 3000);

function broadcastNew() {
    var message = new Buffer(news[Math.floor(Math.random()*news.length)]);
    server.send(message, 0, message.length, 8088, "127.0.0.1");
    console.log("Sent " + message + " to the wire...");
    //server.close();
}