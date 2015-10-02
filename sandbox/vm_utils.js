var util = require('util');
var vm = require('vm');

var VMPromise = function (vmObject) {
    this._doneCallback = [];
    this._errorCallback = [];
    this._safeVal = null;
    this._safeValApplied = false;
    this._unsafeVal = null;
    this._unsafeValApplied = false;
    this.vmObject = vmObject;
};

VMPromise.prototype.safeResolve = function(value) {
    if (this._safeValApplied || this._unsafeValApplied) {
        return;
    }
    this._safeVal = value;
    this._safeValApplied = true;
    this._doneCallback.forEach(function(callback) {
        this.vmObject.safeCallback(callback, undefined, value);
    }, this);
};

VMPromise.prototype.unsafeResolve = function(value) {
    if (this._safeValApplied || this._unsafeValApplied) {
        return;
    }
    this._unsafeVal = value;
    this._unsafeValApplied = true;
    this._doneCallback.forEach(function(callback) {
        this.vmObject.unsafeCallback(callback, undefined, value);
    }, this);
};

VMPromise.prototype.getPromise = function() {
    var thisObj = this;
    return {
        'then': function(doneCallback, errorCallback) {
            if (this._safeValApplied) {
                thisObj.vmObject.safeCallback(callback, undefined, thisObj._safeVal);
            } else if (this._unsafeValApplied) {
                thisObj.vmObject.safeCallback(callback, undefined, thisObj._unsafeVal);
            } else {
                if (typeof doneCallback === 'function')
                    thisObj._doneCallback.push(doneCallback);
                if (typeof errorCallback === 'function')
                    thisObj._errorCallback.push(errorCallback);
            }
        }
    }
};
exports.VMPromise = VMPromise;

var VMObject = function () {
    this.sandbox = vm.createContext({});
    this.tempCounter = 0;
    var thisObj = this;

    this.addItems({
        'setTimeout': function (code,delay) {
            try {
                setTimeout(function () {
                    thisObj.unsafeCallback(code);
                }, delay);
            } catch (error) {
                thisObj.setError(error);
            }
        }
    });
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
    return this._getTempStorage()[res];
};

VMObject.prototype.popTempVariable = function(id) {
    var res = this._getTempStorage()[res];
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
        res += JSON.stringify(val) + ','
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
    console.log('error: ' + util.inspect(e));
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
exports.VMObject = VMObject;