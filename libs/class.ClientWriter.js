'use strict';

const
    precon = require('@mintpond/mint-precon'),
    buffers = require('@mintpond/mint-utils').buffers,
    Job = require('./class.Job'),
    StratumError = require('./class.StratumError'),
    algorithm = require('./service.algorithm');


class ClientWriter {

    /**
     * Constructor.
     *
     * @param args
     * @param args.client {Client}
     */
    constructor(args) {
        precon.notNull(args.client, 'client');

        const _ = this;
        _._client = args.client;
        _._port = _._client.port;
        _._socket = _._client.socket;
    }


    reply(args) {
        precon.integer(args.replyId, 'replyId');
        precon.opt_boolean(args.result, 'result');
        precon.opt_instanceOf(args.error, StratumError, 'error');

        const _ = this;

        const replyId = args.replyId;
        const result = args.result;
        const error = args.error;

        _._socket.send({
            id: replyId,
            result: error ? false: result,
            error: error ? error.responseArr: null
        });
    }


    replySubscribe(args) {
        precon.integer(args.replyId, 'replyId');

        const _ = this;

        const replyId = args.replyId;
        const subscriptionIdHex = _._client.subscriptionIdHex;
        const extraNonce1Hex = _._client.extraNonce1Hex;

        _._socket.send({
            id: replyId,
            result: [subscriptionIdHex, extraNonce1Hex],
            error: null
        });
    }


    miningNotify(args) {
        precon.instanceOf(args.job, Job, 'job');
        precon.boolean(args.cleanJobs, 'cleanJobs');
        precon.positiveNumber(args.diff, 'diff');

        const _ = this;

        const job = args.job;
        const cleanJobs = args.cleanJobs;
        const diff = args.diff;

        const nDiff = diff / algorithm.multiplier;
        const targetBuf = buffers.packUInt256LE(algorithm.diff1 / nDiff);

        const m = {
            id: null,
            method: 'mining.notify',
            params: [
                /* 0 Job Id        */ job.idHex,
                /* 1 progpow hash  */ job.getProgPowHashBuf(_._client).toString('hex'),
                /* 2 seed hash     */ job.seedHashBuf.toString('hex'),
                /* 3 share target  */ buffers.leToHex(targetBuf),
                /* 4 clean_jobs    */ cleanJobs,
                /* 5 block height  */ job.height,
                /* 6 nbits (diff)  */ buffers.leToHex(job.bitsBuf)
            ]
        };

        console.log(m);
        _._socket.send(m);
    }
}

module.exports = ClientWriter;