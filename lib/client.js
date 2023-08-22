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
            case ('system'):
                switch (dp[3]) {
                    case ('brightness'):
                        send2wiobrowser('brightness|' + state.val);
                        break;
                    case ('screenon'):
                        if (state.val) {
                            send2wiobrowser('screenon|true');
                            adapter.setState('system.screenon', false, true);
                        }
                        break;
                    case ('screenoff'):
                        if (state.val) {
                            send2wiobrowser('screenoff|true');
                            adapter.setState('system.screenoff', false, true);
                        }
                        break;
                    case ('close'):
                        if (state.val) {
                            send2wiobrowser('close|true');
                            adapter.setState('system.close', false, true);
                        }
                        break;
                    case ('reboot'):
                        if (state.val) {
                            send2wiobrowser('reboot|true');
                            adapter.setState('system.reboot', false, true);
                        }
                        break;
                    case ('shutdown'):
                        if (state.val) {
                            send2wiobrowser('shutdown|true');
                            adapter.setState('system.shutdown', false, true);
                        }
                        break;
                    case ('screensaver'):
                        if (state.val) {
                            send2wiobrowser('screensaver|true');
                            adapter.setState('system.screensaver', false, true);
                        }
                        break;
                    case ('startmenu'):
                        if (state.val) {
                            send2wiobrowser('startmenu|true');
                            adapter.setState('system.startmenu', false, true);
                        }
                        break;
                }
                break;
            case ('command'):
                send2wiobrowser('command|' + state.val.replace(' ', '|'));
                break;
            case ('sip'):
                if (dp[3] == 'action') {
                    switch (dp[4]) {
                        case ('hangup'):
                            if (state.val) {
                                send2wiobrowser('hangup|true');
                                adapter.setState('sip.action.hangup', false, true);
                            }
                            break;
                        case ('answer'):
                            if (state.val) {
                                send2wiobrowser('answer|true');
                                adapter.setState('sip.action.answer', false, true);
                            }
                            break;
                        case ('dooropen'):
                            if (state.val) {
                                send2wiobrowser('dooropen|true');
                                adapter.setState('sip.action.dooropen', false, true);
                            }
                            break;
                        case ('videooff'):
                            if (state.val) {
                                send2wiobrowser('videooff|true');
                                adapter.setState('sip.action.videooff', false, true);
                            }
                            break;
                    }
                }
                break;
            case ('audio'):
                switch (dp[3]) {
                    case ('play'):
                        send2wiobrowser('play|' + state.val);
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
                }
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
                        send2wiobrowser('slideshow|' + state.val);
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
                        if (messages == null) {
                            send2wiobrowser('message|Nachricht von ioBroker|' + state.val + '|10|0|0|#FF0000');
                        } else {
                            if ((messages.length >= style) && (style > 0)) {
                                send2wiobrowser('message|' + messages[style - 1].titel + '|' + state.val + '|' +
                                    messages[style - 1].time + '|' + messages[style - 1].color);
                            } else {
                                send2wiobrowser('message|Nachricht von ioBroker|' + state.val + '|10|0|0|#FF0000');
                            }
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
            ++index;
            if (index >= pages.length) index = 0;
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
                adapter.log.debug('Typ: ' + obj.TYP + ' - Value: ' + obj.VAL);
                switch (obj.TYP) {
                    case ('URL'):
                        adapter.setState('web.receiveURL', obj.URL, true);
                        break;
                    case ('SIP'):
                        switch (obj.SIP) {
                            case ('CALL'):
                                if (obj.VAL == 'TRUE') {
                                    adapter.setState('sip.call', true, true);
                                } else {
                                    adapter.setState('sip.call', false, true);
                                }
                                break;
                            case ('RING'):
                                if (obj.VAL == 'TRUE') {
                                    adapter.setState('sip.ring', true, true);
                                } else {
                                    adapter.setState('sip.ring', false, true);
                                }
                                break;
                            case ('HUNGUP'):
                                if (obj.VAL == 'TRUE') {
                                    adapter.setState('sip.hungup', true, true);
                                } else {
                                    adapter.setState('sip.hungup', false, true);
                                }
                                break;
                        }
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
                        adapter.setState('audio.volume', Number(obj.VOLUME), true);
                        break;
                    case ('MUTE'):
                        if (obj.MUTE == 'TRUE') {
                            adapter.setState('audio.mute', true, true);
                        } else {
                            adapter.setState('audio.mute', false, true);
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
            send2wiobrowser('config|' + adapter.config.top + '|' + adapter.config.left + '|' + adapter.config.color + '|' + adapter.config.font + '|' + adapter.config.transparency);
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

    return this;
}

module.exports = wioBrowserClient;
