var express = require('express');
var bodyParser = require('body-parser');
//var multer = require('multer');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/jsSettlers');
var app = express();
app.use(express.static(process.cwd() + '/www/'));

var html_dir = __dirname + "/www/";

app.get('/', function (req, res) {
    res.sendFile(html_dir + 'index.html');
});

var server = app.listen(5000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('App listening at http://%s:%s', host, port)
});