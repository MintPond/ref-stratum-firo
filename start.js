'use strict';

const Stratum = require('./libs/class.Stratum');

const stratum = new Stratum({
    coinbaseAddress: 'TC6qME2GhepR7656DgsR72pkQDmhfTDbtV',
    blockBrand: '/@mintpond/ref-stratum/',
    host: "0.0.0.0",
    port: {
        number: 3000,
        diff: 512
    },
    rpc: {
        host: '172.16.3.102',
        port: 17001,
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
    if (ev.share.isValidBlock) {
        console.log(`Valid block submitted by ${ev.share.client.workerName}`)
    }
    else if (ev.share.isValidShare) {
        console.log(`Valid share submitted by ${ev.share.client.workerName}`)
    }
    else {
        console.log(`Valid share submitted by ${ev.share.client.workerName} ${ev.share.error.message}`)
    }
});