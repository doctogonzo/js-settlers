var vm_utils = require('./vm_utils.js');

var vmObjects = {};
var responseWait = {};
var vmIdGen = vm_utils.vmGetResponseIdGenerator();

process.on('message', function(msg) {
    switch (msg.msg) {
        case 'createVM': {
            var vm = new vm_utils.VMObject(msg.data.forkCnt);
            if (typeof vmObjects[msg.id] !== 'undefined') {
                vmObjects[msg.id].releaseObject();
            }
            vmObjects[msg.id] = vm;
            var methods = {};
            msg.data.methods.forEach(function(method) {
                methods[method] = function(data, callback, context) {
                    var needResponse = typeof callback === 'function';
                    var respId = needResponse ? vmIdGen.getId() : undefined;
                    if (needResponse)
                        responseWait[respId] = { id: msg.id, callback: callback, context: context };
                    process.send({
                        msg: 'call',
                        id: method,
                        data: data,
                        responseId: respId
                    });
                }
            });
            vm.addItems(methods);
            vm.setError = function(err) {
                vm_utils.VMObject.prototype.setError.apply(vm, arguments);
                process.send({ msg: 'error', data: err });
            };
            vm.addLog = function(type, value) {
                vm_utils.VMObject.prototype.addLog.apply(vm, arguments);
                process.send({ msg: 'log', id: msg.id, data: { type: type, value: value } });
            };
            vm.eval(msg.data.src);
        } break;
        case 'call': {
            var vmCall = vmObjects[msg.id];
            var args = [];
            args.push(msg.data.method);
            if (Array.isArray(msg.data.args)) {
                args = args.concat(msg.data.args);
            }
            var data = vmCall.unsafeCall.apply(vmCall, args);
            if (typeof msg.responseId !== 'undefined') {
                process.send({type: 'callback', id: msg.responseId, data: data});
            }
        } break;
        case 'callback': {
            var response = responseWait[msg.id];
            if (typeof response === 'undefined')
                break;
            var respVM = vmObjects[response.id];
            if (typeof respVM !== 'undefined') {
                respVM.unsafeCallback(response.callback, response.context, msg.data);
            }
            delete responseWait[msg.id];
        } break;
    }
});
