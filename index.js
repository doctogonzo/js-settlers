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

var vm_utils = require('./sandbox/vm_utils.js');
var vm = new vm_utils.VMRunner();
vm.run(
    0,
    "fork('done(\"fff\");', { 'done': function(msg) { done(\"message \" + msg); } });",
    {
        'done': function(msg) {
            console.log('test done with ' + msg)
        }
    },
    1
);

