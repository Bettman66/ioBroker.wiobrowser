'use strict';
const net = require('net');

function wioBrowserClient(adapter) {
    if (!(this instanceof wioBrowserClient)) return new wioBrowserClient(adapter);

    let client = null;
    let connected = false;
    let tout_error;
    let tout_close;
    let tout_timeout;

    this.destroy = () => {
        if (client) {
            clearTimeout(tout_error);
            clearTimeout(tout_close);
            clearTimeout(tout_timeout);
            tout_error = null;
            tout_close = null;
            tout_timeout = null;
            client.destroy();
            client = null;
        }
    };

    this.onStateChange = (id, state) => send2Server(id, state);

    function send2wiobrowser(str) {
        client.write(str);
    }

    function send2Server(id, state) {
        if ((!client) || (!connected) || (!state.val)) return;
        adapter.log.debug('stateChange ' + id + ': ' + JSON.stringify(state));
        var dp = (id.split('.'));
        switch (dp[2]) {
            case ('sendURL'):
                send2wiobrowser(state.val);
                break;
        }
    }

    (function _constructor(config) {
        client = new net.Socket();
        client.connect(config.port, config.url, () => { });
        client.setKeepAlive(true, 30000);
        // create connected object and state
        adapter.getObject('info.connection', (err, obj) => {
            if (!obj || !obj.common || obj.common.type !== 'boolean') {
                obj = {
                    _id: 'info.connection',
                    type: 'state',
                    common: {
                        role: 'indicator.connected',
                        name: 'If connected to wioBrowser',
                        type: 'boolean',
                        read: true,
                        write: false,
                        def: false
                    },
                    native: {}
                };
                adapter.setObject('info.connection', obj, () => adapter.setState('info.connection', connected, true));
            }
        });

        client.on('data', function (data) {
            try {
                var obj = JSON.parse(data.toString('utf8'));
                adapter.log.debug('Typ: ' + obj.TYP);
                switch (obj.TYP) {
                    case ('URL'):
                        adapter.setState('receiveURL', obj.URL, true);
                        break;
                }
            } catch (err) {
                adapter.log.debug(err);
            }
        });

        client.on('connect', () => {
            adapter.log.info('Connected to ' + config.url);
            connected = true;
            adapter.setState('info.connection', connected, true);
        });

        client.on('error', err => {
            adapter.log.error('Client error:' + err);

            if (connected) {
                adapter.log.info('Disconnected from ' + config.url);
                connected = false;
                adapter.setState('info.connection', connected, true);
            }
            tout_error = setTimeout(() => {
                tout_error = null;
                _constructor(config);
            }, 10000);
        });

        client.on('close', () => {
            if (connected) {
                adapter.log.info('Disconnected from ' + config.url);
                connected = false;
                adapter.setState('info.connection', connected, true);
                tout_close = setTimeout(() => {
                    tout_close = null;
                    _constructor(config);
                }, 10000);
            }
        });
    })(adapter.config);

    process.on('uncaughtException', err => adapter.log.error('uncaughtException: ' + err));

    return this;
}

module.exports = wioBrowserClient;
