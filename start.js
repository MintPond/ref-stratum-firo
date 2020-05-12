'use strict';

const Stratum = require('./libs/class.Stratum');

const stratum = new Stratum({
    coinbaseAddress: 'mpN96WyD5Xb8q66aVsfd7P6P2WJDdqapKf',
    blockBrand: '/@mintpond/ref-stratum/',
    host: "0.0.0.0",
    port: {
        number: 3020,
        diff: 1024
    },
    rpc: {
        host: '172.0.0.1',
        port: 8888,
        user: 'rpcuser',
        password: "x"
    },
    jobUpdateInterval: 55,
    blockPollIntervalMs: 250
});

stratum.init();

stratum.on(Stratum.EVENT_CLIENT_CONNECT, ev => {
    console.log(`Client connected: ${ev.client.socket.remoteAddress}`);
});

stratum.on(Stratum.EVENT_CLIENT_DISCONNECT, ev => {
    console.log(`Client disconnected: ${ev.client.socket.remoteAddress} ${ev.reason}`);
});

stratum.on(Stratum.EVENT_SHARE_SUBMITTED, ev => {
    console.log(JSON.stringify(ev.share));
});