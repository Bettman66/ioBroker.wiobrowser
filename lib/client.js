'use strict';
const net = require('net');

function wioBrowserClient(adapter) {
    if (!(this instanceof wioBrowserClient)) return new wioBrowserClient(adapter);

    let client = null;
    let connected = false;
    let tout_error;
    let tout_close;
    let tout_timeout;
    let pages = [];
    let messages = [];
    let intervalObj = null;
    let index = 0;
    let style = 0;

    this.destroy = () => {
        if (client) {
            clearInterval(intervalObj);
            clearTimeout(tout_error);
            clearTimeout(tout_close);
            clearTimeout(tout_timeout);
            tout_error = null;
            tout_close = null;
            tout_timeout = null;
            intervalObj = null;
            client.destroy();
            client = null;
        }
    };

    this.onStateChange = (id, state) => send2Server(id, state);

    function send2wiobrowser(str) {
        if (connected) {
            client.write(str);
        } else {
            clearInterval(intervalObj);
        }
    }

    function send2Server(id, state) {
        adapter.log.debug('stateChange ' + id + ': ' + JSON.stringify(state));
        const dp = (id.split('.'));
        adapter.log.debug(dp[2] + ' -> ' + state.val);
        switch (dp[2]) {
            case ('sendURL'):
                send2wiobrowser('sendUrl|' + state.val);
                adapter.setState('error', false, true);
                break;
            case ('zoom'):
                send2wiobrowser('zoom|' + state.val);
                break;
            case ('screenon'):
                if (state.val) {
                    send2wiobrowser('screenon|true');
                    adapter.setState('screenon', false, true);
                }
                break;
            case ('screenoff'):
                if (state.val) {
                    send2wiobrowser('screenoff|true');
                    adapter.setState('screenoff', false, true);
                }
                break;
            case ('slide'):
                if (state.val) {
                    if (connected) {
                        slideshow();
                    } else {
                        adapter.setState('slide', false, true);
                    }
                } else {
                    clearInterval(intervalObj);
                }
                break;
            case ('message'):
                if ((messages.length >= style) && (style > 0)) {
                send2wiobrowser('message|' + messages[style-1].titel + '|' + state.val + '|' +
                    messages[style-1].time + '|' + messages[style-1].left + '|' + messages[style-1].top + '|' + messages[style-1].color);
                } else {
                    send2wiobrowser('message|Nachricht von ioBroker|' + state.val + '|10|0|0|#F8FFC9');
                }
                break;
            case ('messagenumber'):
                if ((messages.length >= state.val) && (state.val > 0)) {
                send2wiobrowser('message|' + messages[state.val-1].titel + '|' + messages[state.val-1].caption + '|' +
                    messages[state.val-1].time + '|' + messages[state.val-1].left + '|' + messages[state.val-1].top + '|' + messages[state.val-1].color);
                };
                break;
            case ('messagestyle'):
                if ((style <= messages.length) && (state.val > 0)){
                    style = state.val;
                } else {
                    style = 0;
                }
                break;
            case ('close'):
                if (state.val) {
                    send2wiobrowser('close|true');
                    adapter.setState('close', false, true);
                }
                break;
        }
    }

    function slideshow() {
        if (pages.length > 0) {
            adapter.log.debug(pages[index].name);
            send2wiobrowser('sendUrl|' + pages[index].name);
            adapter.setState('error', false, true);
            if (pages[index].zoom) {
                send2wiobrowser('zoom|' + pages[index].zoom);
            } else {
                send2wiobrowser('zoom|1');
            }
            clearInterval(intervalObj);
            if (pages[index].time) {
                intervalObj = setInterval(slideshow, pages[index].time * 1000);
            } else {
                intervalObj = setInterval(slideshow, 10000);
            }
            index = index + 1;
            if (index > pages.length - 1) index = 0;
        }
    }

    (function _constructor(config) {
        pages = config.pages;
        messages = config.messages;
        adapter.getState('messagestyle', function (err, state) {
            if (state.val) style = state.val;
        });
        client = new net.Socket();
        client.connect(config.port, config.url, () => { });
        client.setKeepAlive(true, 30000);

        client.on('data', function (data) {
            try {
                const obj = JSON.parse(data.toString('utf8'));
                adapter.log.debug('Typ: ' + obj.TYP);
                switch (obj.TYP) {
                    case ('URL'):
                        adapter.setState('receiveURL', obj.URL, true);
                        break;
                    case ('BATTERY'):
                        adapter.setState('battery', Number(obj.BATTERY), true);
                        break;
                    case ('EVENT'):
                        if (obj.EVENT == 'GOTFOCUS') {
                            adapter.getState('slide', function (err, state) {
                                if (state.val) adapter.setState('slide', false, true);
                            });
                        }
                        break;
                    case ('ERROR'):
                        if (obj.ERROR = "TRUE") {
                            adapter.setState('error', true, true);
                        }
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
