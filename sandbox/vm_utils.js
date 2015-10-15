var vm = require('vm'),
    fork = require('child_process').fork;

//var VMPromise = function (vmObject) {
//    this._doneCallback = [];
//    this._errorCallback = [];
//    this._safeVal = null;
//    this._safeValApplied = false;
//    this._unsafeVal = null;
//    this._unsafeValApplied = false;
//    this.vmObject = vmObject;
//};
//
//VMPromise.prototype.safeResolve = function(value) {
//    if (this._safeValApplied || this._unsafeValApplied) {
//        return;
//    }
//    this._safeVal = value;
//    this._safeValApplied = true;
//    this._doneCallback.forEach(function(callback) {
//        this.vmObject.safeCallback(callback, undefined, value);
//    }, this);
//};
//
//VMPromise.prototype.unsafeResolve = function(value) {
//    if (this._safeValApplied || this._unsafeValApplied) {
//        return;
//    }
//    this._unsafeVal = value;
//    this._unsafeValApplied = true;
//    this._doneCallback.forEach(function(callback) {
//        this.vmObject.unsafeCallback(callback, undefined, value);
//    }, this);
//};
//
//VMPromise.prototype.getPromise = function() {
//    var thisObj = this;
//    return {
//        'then': function(doneCallback, errorCallback) {
//            if (this._safeValApplied) {
//                thisObj.vmObject.safeCallback(callback, undefined, thisObj._safeVal);
//            } else if (this._unsafeValApplied) {
//                thisObj.vmObject.safeCallback(callback, undefined, thisObj._unsafeVal);
//            } else {
//                if (typeof doneCallback === 'function')
//                    thisObj._doneCallback.push(doneCallback);
//                if (typeof errorCallback === 'function')
//                    thisObj._errorCallback.push(errorCallback);
//            }
//        }
//    }
//};
//exports.VMPromise = VMPromise;

function vmAddLog(logInd, log, type, value) {
    log += '\n' + logInd++ + ' ' + type + ': ' + value;
    var trunc = log.length - 1000;
    if (trunc > 0)
        log = log.slice(trunc);
    return log;
}

var vmGetResponseIdGenerator = function() {
    var id = 0;
    return {
        getId: function() {
            id++;
            if (id >= Number.MAX_VALUE)
                id = Number.MIN_VALUE;
        }
    }
};
exports.vmGetResponseIdGenerator = vmGetResponseIdGenerator;



var VMRunner = function() {
    this.subModule = null;
    this.responseWait = {};
    this.idGen = vmGetResponseIdGenerator();
    this.logCnt = 0;
    this.log = '';
};

VMRunner.prototype.run = function(vmId, src, methods, forkCnt) {
    if (this.subModule === null) {
        this.subModule = fork('./sandbox/vm_module.js');
        var thisObj = this;
        this.subModule.on('message', function (msg) {
            switch (msg.msg) {
                case 'call': {
                    var data = methods[msg.id].call(methods, msg.data);
                    if (typeof msg.responseId !== 'undefined') {
                        thisObj.subModule.send({type: 'callback', id: msg.responseId, data: data});
                    }
                } break;
                case 'error': {
                    thisObj.onError(msg.data);
                } break;
                case 'log': {
                    thisObj.onLog(msg.id, msg.data.type, msg.data.value);
                } break;
                case 'callback': {
                    var response = thisObj.responseWait[msg.id];
                    if (typeof response !== 'undefined') {
                        response.callback.call(response.context, msg.data);
                        delete thisObj.responseWait[msg.id];
                    }
                } break;
            }
        }).on('close', function () {
            console.error('test code fallen in the darkness');
        });
    }
    var arrMethods = [];
    for (var method in methods) {
        if (methods.hasOwnProperty(method))
            arrMethods.push(method);
    }
    this.subModule.send({
        msg: 'createVM',
        id: vmId,
        data: {
            src: src,
            methods: arrMethods,
            forkCnt: forkCnt
        }
    })
};

VMRunner.prototype.call = function(vmId, method, args, callback, context) {
    var respNeed = typeof callback === 'function';
    var respId = respNeed ? this.idGen.getId() : undefined;
    if (respNeed)
        this.responseWait[respId] = { callback: callback, context: context };
    this.subModule.send({ msg: 'call', id: vmId, data: { method: method, args: args }, responseId: respId });
};

VMRunner.prototype.onError = function(error) {

};

VMRunner.prototype.onLog = function (id, type, value) {
    this.log = vmAddLog(this.logCnt++, this.log, type, value);
};

VMRunner.prototype.terminate = function() {
    this.subModule.kill();
    this.subModule = null;
    this.responseWait = {};
};
exports.VMRunner = VMRunner;

var VMObject = function (forkCnt) {
    this.sandbox = vm.createContext({});
    this.tempCounter = 0;
    var thisObj = this;
    this.log = '';
    this.logCnt = 0;
    var forks = 0;
    this.addItems({
        'setTimeout': function (code,delay) {
            try {
                setTimeout(function () {
                    thisObj.unsafeCallback(code);
                }, delay);
            } catch (error) {
                thisObj.setError(error);
            }
        },
        'writeLog': function(message) {
            thisObj.addLog('INFO', message);
        },
        'fork': function(src, methods) {
            if (!(forks < forkCnt))
                return;
            forks++;
            var child = new VMRunner();
            var intMethods = {};
            for (var method in methods) {
                if (!methods.hasOwnProperty(method))
                    continue;
                intMethods[method] = (function(method) {
                    return function(data) {
                        thisObj.unsafeCallback(methods[method], methods, data);
                    }
                })(method);
            }
            child.run(0, src, intMethods, 0);
            return {
                'callMethod': function(method, args, callback, context) {
                    child.call(0, method, args, typeof callback === 'function' ? function(data) {
                        thisObj.unsafeCallback(callback, context, data);
                    } : null);
                },
                'terminate': function() {
                    child.terminate();
                    forks--;
                }
            };
        }
    });
};

VMObject.prototype.addLog = function(type, value) {
    this.log = vmAddLog(this.logCnt++, this.log, type, value);
};

VMObject.prototype._getTempStorage = function() {
    return this.sandbox;
};

VMObject.prototype.pushTempVariable = function(value) {
    this.tempCounter++;
    if (this.tempCounter >= Number.MAX_VALUE)
        this.tempCounter = 0;
    var id = '__t' + this.tempCounter;
    this._getTempStorage()[id] = value;
    return id;
};

VMObject.prototype.peekTempVariable = function(id) {
    return this._getTempStorage()[id];
};

VMObject.prototype.popTempVariable = function(id) {
    var res = this._getTempStorage()[id];
    delete this._getTempStorage()[id];
    return res;
};

VMObject.prototype.addItems = function (methods) {
    for (var id in methods) {
        if (!methods.hasOwnProperty(id))
            continue;
        this.sandbox[id] = methods[id];
    }
};

VMObject.prototype.eval = function(src) {
    try {
        vm.runInContext(src, this.sandbox, { timeout: 100 });
    } catch(error){
        this.setError(error);
    }
};

VMObject.prototype._stringifyArguments = function(args) {
    var res = '';
    args.forEach(function(val) {
        res += JSON.stringify(val) + ',';
    });
    return res.slice(0,-1);
};

VMObject.prototype.safeCall = function(methodId) {
    var args = Array.prototype.slice.call(arguments, 1);
    var resId = this.pushTempVariable();
    var command = resId + '=' + methodId + '(' + this._stringifyArguments(args) + ')';
    this.eval(command);
    var res = this.popTempVariable(resId);
    if (typeof res === 'undefined')
        return;
    return JSON.parse(JSON.stringify(res));
};

VMObject.prototype.unsafeCall = function(methodId) {
    var args = Array.prototype.slice.call(arguments, 1);
    var resId = this.pushTempVariable();
    var paramId = this.pushTempVariable(args);
    this.eval(resId + '=' + methodId + '.apply(undefined,' + paramId + ')');
    this.popTempVariable(paramId);
    return this.popTempVariable(resId);
};

VMObject.prototype.setError = function(e) {
    this.addLog('ERROR', e);
    this.log += '\nERROR: ' + e;
};

VMObject.prototype.safeCallback = function(callback, context) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = this.pushTempVariable(callback);
    var contextId = this.pushTempVariable(context);
    var command = id + '.call(' + contextId + ',' + this._stringifyArguments(args) + ')';
    this.eval(command);
    this.popTempVariable(contextId);
    this.popTempVariable(id);
};

VMObject.prototype.unsafeCallback = function(callback, context) {
    var args = Array.prototype.slice.call(arguments, 2);
    var paramId = this.pushTempVariable(args);
    var id = this.pushTempVariable(callback);
    var contextId = this.pushTempVariable(context);
    var command = id + '.apply(' + contextId + ',' + paramId + ')';
    this.eval(command);
    this.popTempVariable(contextId);
    this.popTempVariable(id);
    this.popTempVariable(paramId);
};

VMObject.prototype.releaseObject = function() {
    delete this.sandbox;
};
exports.VMObject = VMObject;

exports.extend = function(parent, methods) {
    var child = function () {
        var args = Array.prototype.slice.call(arguments);
        var _constructor = methods._constructor;
        if (_constructor !== null && typeof(_constructor) !== 'undefined')
            _constructor.apply(this, args);
    };
    var F = function() { };
    F.prototype = parent.prototype;
    child.prototype = new F();
    child.prototype.constructor = child;
    child.superclass = parent.prototype;
    for (var method in methods) {
        if (!methods.hasOwnProperty(method))
            continue;
        child.prototype[method] = methods[method];
    }
    return child;
};