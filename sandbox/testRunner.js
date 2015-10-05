var cp = require('child_process'),
    Promise = require('node-promise').Promise;

exports.run = function(environmentSrc, players) {
    var submodule = cp.fork('./sandbox/testModule.js');//, [], { silent: true });
    var resolved = false;
    var promise = new Promise();
    submodule.on('message', function(msg) {
        switch (msg.msg) {
            case 'done': {
                promise.resolve(msg.data);
                submodule.kill();
                resolved = true;
            } break;
            case 'error': {
                console.log(msg.data);
            } break;
            case 'playerError': {
                console.log(msg.data);
            } break;
            case 'systemError': {
                promise.reject();
                submodule.kill();
            }
        }
    }).on('close', function() {
        if (!resolved) {
            console.error('test code fallen in the darkness');
            promise.reject();
        }
    });
    submodule.send({msg: 'setTest', data: {environmentSrc: environmentSrc, players: players}});
    return promise;
};