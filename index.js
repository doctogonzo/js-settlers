var express = require('express'),
    bodyParser = require('body-parser'),
    //multer = require('multer'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/jsSettlers');
var app = express();
app.use(express.static(process.cwd() + '/www/'));

var html_dir = __dirname + "/www/";

app.get('/', function (req, res) {
    res.sendFile(html_dir + 'index.html');
});

var server = app.listen(5000, function () {
    var host = server.address().address,
        port = server.address().port;

    console.log('App listening at http://%s:%s', host, port)
});

var sandbox = require('./sandbox/testRunner.js'),
    util = require('util');
sandbox.run("var i = 0;var results = [];runPlayer('j = 0', 0, {'inc': function(num) { i += num; if (i === 10) setResults(0); }});", [{code:'inc(5);inc(5);'}]).then(
    function(res) {
        console.log(util.inspect(res));
    },
    function() {
        console.error("oh no they killed sendBox you bastards");
    }
);
