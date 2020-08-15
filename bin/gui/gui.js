#!/usr/bin/env node

const app = require('express')(); // Express prevzame nalogo HTML strežnika
const http = require('http').createServer(app); // Ustvarimo http strežnik, njegov handler je app - express
http.listen(8080); // http strežniku določimo vrata

const exec = require('child_process').exec;


//  Serving files
app.get('/', function(req, res) {
	res.sendfile('public/index.html');
});

app.get('/scripts/jquery.min.js', function(req, res) {
	res.sendfile('public/scripts/jquery.min.js');
});

app.get('/scripts/bootstrap.min.js', function(req, res) {
	res.sendfile('public/scripts/bootstrap.min.js');
});

app.get('/styles/bootstrap.min.css', function(req, res) {
	res.sendfile('public/styles/bootstrap.min.css');
});

//	Getting data from OpenVPN server
app.get('/clientList.json', function(req, res) {
	res.setHeader('Content-Type', 'application/json');
	exec('/usr/local/bin/ovpn_listclients_json', function(error, stdout, stderr){ res.end(stdout); });
});
