#!/usr/bin/env node

const app = require('express')(); // Express prevzame nalogo HTML strežnika
const http = require('http').createServer(app); // Ustvarimo http strežnik, njegov handler je app - express
http.listen(8080); // http strežniku določimo vrata

const exec = require('child_process').exec;
const fs = require('fs');

let serverStatus;

try {
	configFile = fs.readFileSync('/etc/openvpn/gui-conf.json');
	serverStatus = JSON.parse(configFile);
} catch (err) {
	serverStatus = new Object();
	serverStatus.isSetup = false;
	serverStatus.isRunning = false;
	serverStatus.domain = 'vasa.domena.si';
}

let server;

//	Start the OpenVPN server process if it was running before
if (serverStatus.isRunning) {
	server = exec('ovpn_run');
}

//  Serving files
app.get('/', function(req, res) {
	if (serverStatus.isSetup) {
		res.sendFile('/usr/local/bin/gui/public/index_config.html');
	} else {
		res.sendFile('/usr/local/bin/gui/public/index_setup.html');
	}
});

app.get('/scripts/jquery.min.js', function(req, res) {
	res.sendFile('/usr/local/bin/gui/public/scripts/jquery.min.js');
});

app.get('/scripts/bootstrap.min.js', function(req, res) {
	res.sendFile('/usr/local/bin/gui/public/scripts/bootstrap.min.js');
});

app.get('/styles/bootstrap.min.css', function(req, res) {
	res.sendFile('/usr/local/bin/gui/public/styles/bootstrap.min.css');
});

//	Server management
app.get('/startStop', function(req, res) {
	if (serverStatus.isRunning) {
		if (server.kill()) {
			serverStatus.isRunning = false;
		}
	} else {
		server = exec('ovpn_run');
		serverStatus.isRunning = true;
	}
});

//	Client management
app.get('/addClient', function(req, res) {
	if (serverStatus.isSetup) {
		username = req.query.username;
		if (username) {
			exec('/usr/local/bin/easyrsa build-client-full ' + username + ' nopass', function(error, stdout, stderr){ res.send(stdout); });
		} else {
			res.status(400).send("Specify Username!");
		}
	} else {
		res.status(409).send('Setup the server before adding clients');
	}
});

app.get('/revokeClient', function(req, res) {
	if (serverStatus.isSetup) {
		username = req.query.username;
		if (username) {
			exec('/usr/local/bin/ovpn_revokeclient ' + username + ' remove', function(error, stdout, stderr){ res.send(stdout); });
		} else {
			res.status(400).send("Specify Username!");
		}
	} else {
		res.status(409).send('Setup the server before revoking clients');
	}
});

//	Getting data from OpenVPN server
app.get('/clientList.json', function(req, res) {
	if (serverStatus.isSetup) {
		res.setHeader('Content-Type', 'application/json');
		exec('/usr/local/bin/ovpn_listclients_json', function(error, stdout, stderr){ res.end(stdout); });
	} else {
		res.status(409).send('Setup the server before listing clients');
	}
});

app.get('/getOvpn', function(req, res) {
	if (serverStatus.isSetup) {
		username = req.query.username;
		res.setHeader('Content-Type', 'application/x-openvpn-profile');
		res.setHeader('Content-Disposition', 'attachment');
		res.setHeader('Content-Disposition', 'filename="' + username +'.ovpn"');
		exec('/usr/local/bin/ovpn_getclient ' + username, function(error, stdout, stderr){ res.end(stdout); });
	} else {
		res.status(409).send('Setup the server before downloading config');
	}
});

app.get('/getStatus.json', function(req, res) {
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(serverStatus));
});