var vm_utils = require('./vm_utils.js'),
    fork = require('child_process').fork;

var userObj = new vm_utils.VMObject();

process.on('message', function(msg) {
    switch (msg.type) {
        case 'config': {
            var methods = {};
            msg.data.methods.forEach(function(method) {
                methods[method] = function(data) {
                    process.send({type: 'user', id: method, data: data});
                }
            });
            userObj.addItems(methods);
            userObj.setError = function(err) {
                process.send({type: 'error', data: err});
            };
            userObj.eval(msg.data.configCode);
            process.send({type: 'configPass'});
            userObj.eval(msg.data.code);
        } break;
        case 'user': {
            var data = userObj.unsafeCall(msg.id);
            if (typeof msg.responseId !== 'undefined') {
                process.send({type: 'callback', id: msg.responseId, data: data});
            }
        }
    }
});
