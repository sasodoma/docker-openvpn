#!/usr/bin/env node

const app = require('express')(); // Express prevzame nalogo HTML strežnika
const http = require('http').createServer(app); // Ustvarimo http strežnik, njegov handler je app - express
http.listen(8080); // http strežniku določimo vrata

const exec = require('child_process').exec;

app.get('/clientList.json', function(req, res) {
        res.setHeader('Content-Type', 'application/json');
        exec('/usr/local/bin/ovpn_listclients_json', function(error, stdout, stderr){ res.end(stdout); });
});

app.get('/', function(req, res) {
        res.send('<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>');
});

