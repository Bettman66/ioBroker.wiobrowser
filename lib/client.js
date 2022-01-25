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
    let speak = [];
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
        switch (dp[2]) {
            case ('brightness'):
                send2wiobrowser('brightness|' + state.val);
                break;
            case ('volume'):
                send2wiobrowser('volume|' + state.val);
                break;
            case ('mute'):
                if (state.val) {
                    send2wiobrowser('mute|true');
                } else {
                    send2wiobrowser('mute|false');
                }
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
            case ('close'):
                if (state.val) {
                    send2wiobrowser('close|true');
                    adapter.setState('close', false, true);
                }
                break;
            case ('command'):
                send2wiobrowser('command|' + state.val.replace(' ', '|'));
                break;
            case ('web'):
                switch (dp[3]) {
                    case ('sendURL'):
                        send2wiobrowser('sendUrl|' + state.val);
                        adapter.setState('web.error', false, true);
                        break;
                    case ('zoom'):
                        send2wiobrowser('zoom|' + state.val);
                        break;
                    case ('slide'):
                        if (state.val) {
                            if (connected) {
                                slideshow();
                            } else {
                                adapter.setState('web.slide', false, true);
                            }
                        } else {
                            clearInterval(intervalObj);
                        }
                        break;
                }
                break;
            case ('messages'):
                switch (dp[3]) {
                    case ('message'):
                        if ((messages.length >= style) && (style > 0)) {
                            send2wiobrowser('message|' + messages[style - 1].titel + '|' + state.val + '|' +
                                messages[style - 1].time + '|' + messages[style - 1].color);
                        } else {
                            send2wiobrowser('message|Nachricht von ioBroker|' + state.val + '|10|0|0|#FF0000');
                        }
                        break;
                    case ('texttospeech'):
                        send2wiobrowser('texttospeech|' + state.val);
                        break;
                    case ('speakmessage'):
                        if ((speak.length >= state.val) && (state.val > 0)) {
                            send2wiobrowser('texttospeech|' + speak[state.val - 1].text);
                        }
                        break;
                    case ('messagenumber'):
                        if ((messages.length >= state.val) && (state.val > 0)) {
                            send2wiobrowser('message|' + messages[state.val - 1].titel + '|' + messages[state.val - 1].caption + '|' +
                                messages[state.val - 1].time + '|' + messages[state.val - 1].color);
                        }
                        break;
                    case ('messagestyle'):
                        if ((style <= messages.length) && (state.val > 0)) {
                            style = state.val;
                        } else {
                            style = 0;
                        }
                        break;
                }
        }
    }

    function slideshow() {
        if (pages.length > 0) {
            adapter.log.debug(pages[index].name);
            send2wiobrowser('sendUrl|' + pages[index].name);
            adapter.setState('web.error', false, true);
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
        speak = config.speak;
        adapter.getState('messages.messagestyle', function (err, state) {
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
                        adapter.setState('web.receiveURL', obj.URL, true);
                        break;
                    case ('BATTERY'):
                        adapter.setState('info.battery', Number(obj.BATTERY), true);
                        break;
                    case ('CPU'):
                        adapter.setState('info.cpu', Number(obj.CPU), true);
                        break;
                    case ('IP'):
                        adapter.setState('info.ip', obj.IP, true);
                        break;
                    case ('HOST'):
                        adapter.setState('info.host', obj.HOST, true);
                        break;
                    case ('MEMORY'):
                        adapter.setState('info.memory', Number((parseInt(obj.MEMORY) / 1000000).toFixed(2)), true);
                        break;
                    case ('EVENT'):
                        if (obj.EVENT == 'GOTFOCUS') {
                            adapter.getState('web.slide', function (err, state) {
                                if (state.val) adapter.setState('web.slide', false, false);
                            });
                        }
                        break;
                    case ('ERROR'):
                        if (obj.ERROR == 'TRUE') {
                            adapter.setState('web.error', true, true);
                        }
                        break;
                    case ('VOLUME'):
                        adapter.setState('volume', Number(obj.VOLUME), true);
                        break;
                    case ('MUTE'):
                        if (obj.MUTE == 'TRUE') {
                            adapter.setState('mute', true, true);
                        } else {
                            adapter.setState('mute', false, true);
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
            send2wiobrowser('config|' + adapter.config.top + '|' + adapter.config.left + '|' + adapter.config.color + '|' + adapter.config.font);
        });

        client.on('error', err => {
            adapter.log.debug('Client error:' + err);

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

    process.on('uncaughtException', err => adapter.log.debug('uncaughtException: ' + err));

    return this;
}

module.exports = wioBrowserClient;
