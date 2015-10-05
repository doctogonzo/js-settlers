var vm_utils = require('./vm_utils.js'),
    fork = require('child_process').fork;

var VMTestObject = vm_utils.extend(vm_utils.VMObject, {
    _constructor: function(players) {
        VMTestObject.superclass.constructor.apply(this);
        var thisObj = this;
        this.addItems({
            'playersList': JSON.parse(JSON.stringify(players)),
            'setResults': function(res) {
                process.send({msg: 'done', data: {
                    testResult: JSON.parse(JSON.stringify(res)) ,
                    testLog:
                }});
            },
            'runPlayer': function(configCode, playerIndex, methodsModel, errorCallback, configErrorCallback) {
                var submodule = fork('./sandbox/playerModule.js');
                var currMsgId = 0;
                function getNextResponseId() {
                    currMsgId++;
                    if (this.tempCounter >= Number.MAX_VALUE)
                        this.tempCounter = Number.MIN_VALUE;
                }
                var responseWait = {};
                var configDone = false;
                var terminated = false;
                submodule.on('message', function(msg) {
                    switch (msg.type) {
                        case 'callback': {
                            var callbackResp = responseWait[msg.id];
                            if (typeof callbackResp === 'function') {
                                thisObj.unsafeCallback(callbackResp, undefined, msg.data);
                            }
                        } break;
                        case 'user': {
                            var callback = methodsModel[msg.id];
                            if (typeof callback === 'function') {
                                thisObj.unsafeCallback(callback, undefined, msg.data);
                            }
                        } break;
                        case 'configDone': {
                            configDone = true;
                        } break;
                        case 'error': {
                            if (!configDone) {
                                if (typeof configErrorCallback === 'function')
                                    this.safeCallback(configErrorCallback, undefined, playerIndex, msg.error, false);
                                thisObj.setError(msg.error);
                            } else {
                                if (typeof errorCallback === 'function')
                                    this.safeCallback(errorCallback, undefined, playerIndex, msg.error, false);
                                var errors = players[playerIndex].errors;
                                if (!Array.isArray(errors))
                                    players[playerIndex].errors = errors = [];
                                errors.push(msg.error);
                            }
                        } break;
                    }
                }).on('close', function() {
                    if (!terminated) {
                        console.error('user code fallen in the darkness');
                        process.send({msg: 'systemError'});
                    }
                });

                var methods = [];
                for (var methodId in methodsModel) {
                    if (!methodsModel.hasOwnProperty(methodId))
                        continue;
                    methods.push(methodId);
                }

                submodule.send({
                    type: 'config',
                    data: {
                        configCode: configCode,
                        code: players[playerIndex].code,
                        methods: methods
                    }
                });

                return {
                    'callMethod': function(id, data, callback) {
                        var responseId = undefined;
                        if (typeof callback === 'function') {
                            responseId = getNextResponseId();
                            responseWait[responseId] = callback;
                        }
                        submodule.send({ type: 'user', id: id, data: data, responseId: responseId });
                    },
                    'terminate': function() {
                        terminated = true;
                        submodule.kill();
                    }
                }

            }
        });
    },
    setError: function(err) {
        process.send({msg: 'error', data: err});
    }
});

process.on('message', function(msg) {
    switch (msg.msg) {
        case 'setTest': {
            var testObj = new VMTestObject(msg.data.players);
            testObj.eval(msg.data.environmentSrc);
        } break;
    }
});
