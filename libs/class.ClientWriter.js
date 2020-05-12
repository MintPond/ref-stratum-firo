'use strict';

const
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    Job = require('./class.Job'),
    StratumError = require('./class.StratumError');


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
        const extraNonce2Size = _._client.extraNonce2Size;

        _._socket.send({
            id: replyId,
            result: [
                [
                    ['mining.set_difficulty', subscriptionIdHex],
                    ['mining.notify', subscriptionIdHex]
                ],
                extraNonce1Hex,
                extraNonce2Size
            ],
            error: null
        });
    }


    miningNotify(args) {
        precon.instanceOf(args.job, Job, 'job');
        precon.boolean(args.cleanJobs, 'cleanJobs');
        precon.opt_positiveNumber(args.diff, 'diff');

        const _ = this;

        const job = args.job;
        const cleanJobs = args.cleanJobs;
        const diff = args.diff;

        if (mu.isNumber(diff)) {
            _._socket.send({
                id: null,
                method: 'mining.set_difficulty',
                params: [diff]
            });
        }

        _._socket.send({
            id: null,
            method: 'mining.notify',
            params: [
                /* 0 Job Id        */ job.idHex,
                /* 1 prevhash      */ job.prevBlockId,
                /* 2 coinb1        */ job.coinbase.coinbase1Buf.toString('hex'),
                /* 3 coinb2        */ job.coinbase.coinbase2Buf.toString('hex'),
                /* 4 merkle_branch */ job.merkleTree.branchHexArr,
                /* 5 version       */ job.versionHex,
                /* 6 nbits (diff)  */ job.bitsHex,
                /* 7 ntime         */ job.curTimeHex,
                /* 8 clean_jobs    */ cleanJobs
            ]
        });
    }
}

module.exports = ClientWriter;