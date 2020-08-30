#!/usr/bin/env node

const app = require('express')(); // Express prevzame nalogo HTML strežnika
const http = require('http').createServer(app); // Ustvarimo http strežnik, njegov handler je app - express
http.listen(8080); // http strežniku določimo vrata

const exec = require('child_process').exec;	// Child_process omogoča zaganjanje zunanjih programov
const fs = require('fs');	// Fs omogoča branje in pisanje datotek

// Objekt server vsebuje podatke o stanju strežnika in metode za upravljanje
const server = {
	isSetup: false,
	setupInProgress: false,
	isRunning: false,
	hasCApass: false,
	domain: '',
	serverExec: null,
	start() {
		if (!this.isRunning) {
			this.isRunning = true;
			this.serverExec = exec('ovpn_run');
		}
	},
	stop() {
		if (this.isRunning) {
			if (this.serverExec.kill()) {
				this.isRunning = false;
			}
		}
	},
	toggle() {
		if (this.isRunning) {
			this.stop();
		} else {
			this.start();
		}
	},
	reset() {
		this.isSetup = false;
		this.setupInProgress = false;
		this.isRunning = false;
		this.hasCApass = false;
		this.domain = '';
	},
	get config() {
		// Funkcija vrne objekt, ki vsebuje konfiguracijo
		return {
			isSetup: this.isSetup,
			isRunning: this.isRunning,
			hasCApass: this.hasCApass,
			domain: this.domain
		};
	},
	set config(config) {
		// Funkcija sprejme objekt in zapiše konfiguracijo
		this.isSetup = config.isSetup;
		this.isRunning = config.isRunning;
		this.hasCApass = config.hasCApass;
		this.domain = config.domain;
	}
};

// S tem prečistimo uporabnikov vnos
const usernameRegex = new RegExp("[^a-z0-9-.]","gi");

// Preberemo konfiguracijo prejšnjega kontejnerja in prepišemo privzeto
try {
	configFile = fs.readFileSync('/etc/openvpn/gui-conf.json');
	server.config = JSON.parse(configFile);
} catch (err) {
	console.log("No config, using defauts.");
}

function saveConfig() {
	fs.writeFileSync('/etc/openvpn/gui-conf.json', JSON.stringify(server.config));
}

//	Start the OpenVPN server process if it was running before
if (server.isRunning) {
	server.isRunning = false;
	server.start();
}

//  Serving files
app.get('/', function(req, res) {
	if (server.isSetup) {
		res.sendFile('/usr/local/bin/gui/public/index_config.html');
	} else if (server.setupInProgress) {
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
	server.toggle();
	saveConfig();
	res.end();
});

app.get('/fullReset', function(req, res) {
	server.stop();
	server.reset();
	exec('rm -r /etc/openvpn/*');
	res.end();
});

//	Client management
app.get('/setupServer', function(req, res) {
	if (!server.isSetup) {
		domain = req.query.domain;
		caPassword = req.query.capass.replace(usernameRegex, "_");
		let invalidDomain = new RegExp("[^a-z0-9-.]","i");
		if (domain && !invalidDomain.test(domain)) {
			let command;
			if (caPassword) {
				command = '/usr/local/bin/ovpn_initpki "" ' + caPassword;
				server.hasCApass = true;
			} else {
				command = '/usr/local/bin/ovpn_initpki nopass';
			}
			server.setupInProgress = true;
			exec('/usr/local/bin/ovpn_genconfig -u udp://' + domain, function(error, stdout, stderr) {
				exec(command, function(error, stdout, stderr) {
					server.domain = domain;
					server.isSetup = true;
					server.start();
					saveConfig();
					server.setupInProgress = false;
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
	if (server.isSetup) {
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
	if (server.isSetup) {
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
	if (server.isSetup) {
		res.setHeader('Content-Type', 'application/json');
		exec('/usr/local/bin/ovpn_listclients_json', function(error, stdout, stderr){ res.end(stdout); });
	} else {
		res.status(409).send('Setup the server before listing clients.');
	}
});

app.get('/getOvpn', function(req, res) {
	if (server.isSetup) {
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
	res.end(JSON.stringify(server.config));
});