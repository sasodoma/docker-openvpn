#!/usr/bin/env node

const app = require('express')(); // Express prevzame nalogo HTML strežnika
const http = require('http').createServer(app); // Ustvarimo http strežnik, njegov handler je app - express
http.listen(8080); // http strežniku določimo vrata

const exec = require('child_process').exec;
const fs = require('fs');

let serverStatus;
let setupInProgress = false;

const usernameRegex = new RegExp("[^a-z0-9-.]","gi");

try {
	configFile = fs.readFileSync('/etc/openvpn/gui-conf.json');
	serverStatus = JSON.parse(configFile);
} catch (err) {
	serverStatus = new Object();
	serverStatus.isSetup = false;
	serverStatus.isRunning = false;
	serverStatus.hasCApass = false;
	serverStatus.domain = 'vasa.domena.si';
}

function saveConfig() {
	fs.writeFileSync('/etc/openvpn/gui-conf.json', JSON.stringify(serverStatus));
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
	} else if (setupInProgress) {
		res.sendFile('/usr/local/bin/gui/public/index_waiting.html');
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
	saveConfig();
	res.end();
});

app.get('/fullReset', function(req, res) {
	if (serverStatus.isRunning) {
		server.kill();
	}
	serverStatus.isRunning = false;
	serverStatus.isSetup = false;
	serverStatus.domain = '';
	serverStatus.hasCApass = false;
	exec('rm -r /etc/openvpn/*')
	res.end();
});

//	Client management
app.get('/setupServer', function(req, res) {
	if (!serverStatus.isSetup) {
		domain = req.query.domain;
		caPassword = req.query.capass.replace(usernameRegex, "_");
		let invalidDomain = new RegExp("[^a-z0-9-.]","i");
		if (domain && !invalidDomain.test(domain)) {
			let command;
			if (caPassword) {
				command = '/usr/local/bin/ovpn_initpki "" ' + caPassword;
				serverStatus.hasCApass = true;
			} else {
				command = '/usr/local/bin/ovpn_initpki nopass';
			}
			setupInProgress = true;
			exec('/usr/local/bin/ovpn_genconfig -u udp://' + domain, function(error, stdout, stderr) {
				exec(command, function(error, stdout, stderr) {
					serverStatus.domain = domain;
					serverStatus.isSetup = true;
					server = exec('ovpn_run');
					serverStatus.isRunning = true;
					saveConfig();
					setupInProgress = false;
					res.send(stdout); 
				});
			});
		} else {
			res.status(400).send("Invalid domain name!");
		}
	} else {
		res.status(409).send('Server is already setup. Do a full reset to change the domain.');
	}
});

//	Client management
app.get('/addClient', function(req, res) {
	if (serverStatus.isSetup) {
		username = req.query.username.replace(usernameRegex, "_");
		caPassword = req.query.capass.replace(usernameRegex, "_");
		if (username) {
			exec('EASYRSA_PASSIN=pass:' + caPassword + ' /usr/local/bin/easyrsa build-client-full ' + username + ' nopass', function(error, stdout, stderr){ res.send(stdout); });
		} else {
			res.status(400).send("Specify Username!");
		}
	} else {
		res.status(409).send('Setup the server before adding clients.');
	}
});

app.get('/revokeClient', function(req, res) {
	if (serverStatus.isSetup) {
		username = req.query.username.replace(usernameRegex, "_");;
		caPassword = req.query.capass.replace(usernameRegex, "_");
		if (username) {
			exec('/usr/local/bin/ovpn_revokeclient ' + username + ' remove ' + caPassword, function(error, stdout, stderr){ res.send(stdout); });
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
		res.status(409).send('Setup the server before listing clients.');
	}
});

app.get('/getOvpn', function(req, res) {
	if (serverStatus.isSetup) {
		username = req.query.username.replace(usernameRegex, "_");;
		res.setHeader('Content-Type', 'application/x-openvpn-profile');
		res.setHeader('Content-Disposition', 'attachment');
		res.setHeader('Content-Disposition', 'filename="' + username +'.ovpn"');
		exec('/usr/local/bin/ovpn_getclient ' + username, function(error, stdout, stderr){ res.end(stdout); });
	} else {
		res.status(409).send('Setup the server before downloading config.');
	}
});

app.get('/getStatus.json', function(req, res) {
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(serverStatus));
});