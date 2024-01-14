/*
 *
 *      ioBroker wioBrowser Adapter
 *
 *      (c) 2023 bettman66<w.zengel@gmx.de>
 *
 *      MIT License
 *
 */

'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const adapterName = require('./package.json').name.split('.').pop();
const Client = require('./lib/client');
let client = null;
let adapter;

function startAdapter(options) {
    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);

    adapter.on('ready', function () {
        main();
    });

    adapter.on('unload', function (callback) {
        if (client) client.destroy();
        callback();
    });

    adapter.on('stateChange', (id, state) => {
        if (state && !state.ack) {
            client.onStateChange(id, state);
        }
    });
    return adapter;
}

function main() {
    adapter.subscribeStates('*');

    client = new Client(adapter);
}

// If started as allInOne/compact mode => return function to create instance
// @ts-ignore
if (module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
