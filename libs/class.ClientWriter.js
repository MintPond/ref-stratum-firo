'use strict';

const
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    buffers = require('@mintpond/mint-utils').buffers,
    algorithm = require('./service.algorithm'),
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


    /**
     * Reply to a message.
     *
     * @param args
     * @param args.replyId {number}
     * @param [args.result] {boolean}
     * @param [args.error] {StratumError}
     */
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


    /**
     * Reply to a mining.subscribe message.
     *
     * @param args
     * @param args.replyId {number}
     */
    replySubscribe(args) {
        precon.integer(args.replyId, 'replyId');

        const _ = this;

        const replyId = args.replyId;
        const subscriptionIdHex = _._client.subscriptionIdHex;
        const extraNonce1Hex = _._client.extraNonce1Hex;

        _._socket.send({
            id: replyId,
            result: [buffers.hexToLE(subscriptionIdHex), buffers.hexToLE(extraNonce1Hex)],
            error: null
        });
    }


    /**
     * Send a mining.notify message.
     *
     * @param args
     * @param args.job {Job}
     * @param args.cleanJobs {boolean}
     * @param args.diff {number}
     */
    miningNotify(args) {
        precon.instanceOf(args.job, Job, 'job');
        precon.boolean(args.cleanJobs, 'cleanJobs');
        precon.opt_positiveNumber(args.diff, 'diff');

        const _ = this;

        const job = args.job;
        const cleanJobs = args.cleanJobs;
        const diff = args.diff;

        if (mu.isNumber(diff)) {

            const nDiff = diff / algorithm.multiplier;
            const targetBuf = buffers.packUInt256LE(algorithm.diff1 / nDiff);

            _._socket.send({
                id: null,
                method: 'mining.set_target',
                params: [targetBuf]
            });
        }

        _._socket.send({
            id: null,
            method: 'mining.notify',
            params: [
                /* 0 Job Id        */ buffers.hexToLE(job.idHex),
                /* 1 prevhash      */ buffers.hexToLE(job.prevBlockId),
                /* 2 coinb1        */ job.coinbase.coinbase1Buf,
                /* 3 coinb2        */ job.coinbase.coinbase2Buf,
                /* 4 merkle_branch */ job.merkleTree.branchBufArr,
                /* 5 version       */ job.versionBuf,
                /* 6 nbits (diff)  */ job.bitsBuf,
                /* 7 ntime         */ job.curTimeBuf,
                /* 8 clean_jobs    */ cleanJobs
            ]
        });
    }
}

module.exports = ClientWriter;