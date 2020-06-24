'use strict';

const
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    buffers = require('@mintpond/mint-utils').buffers,
    Share = require('./class.Share'),
    StratumError = require('./class.StratumError');


class ClientReader {

    /**
     * Constructor.
     *
     * @param args
     * @param args.stratum {Stratum}
     * @param args.client {Client}
     * @param args.writer {ClientWriter}
     */
    constructor(args) {
        precon.notNull(args.stratum, 'stratum');
        precon.notNull(args.client, 'client');
        precon.notNull(args.writer, 'writer');

        const _ = this;
        _._stratum = args.stratum;
        _._client = args.client;
        _._writer = args.writer;
    }


    handleMessage(message) {
        precon.notNull(message, 'message');

        const _ = this;

        if (_._client.isSubscribed && _._client.isAuthorized) {
            return _._handleAuthSubbed(message);
        }
        else if (_._client.isSubscribed) {
            return _._handleSubbed(message);
        }
        else {
            if (message.method === 'mining.subscribe')
                return _._miningSubscribe(message);

            _._client.disconnect('Not subscribed');
            return true;
        }
    }


    _handleAuthSubbed(message) {

        const _ = this;

        switch (message.method) {

            case 'mining.extranonce.subscribe':
                _._writer.reply({
                    replyId: message.id,
                    result: false
                });
                return true/*isHandled*/;

            case 'mining.submit':
                _._client.lastActivity = mu.now();
                return _._miningSubmit(message);

            default:
                if (mu.isNumber(message.id)) {
                    _._writer.reply({
                        replyId: message.id,
                        result: false
                    });
                }
                return false/*isHandled*/;
        }
    }


    _handleSubbed(message) {

        const _ = this;

        switch (message.method) {

            case 'mining.authorize':
                return _._miningAuthorize(message);

            case 'mining.submit':
                _._client.disconnect('Share submit but not subscribed');
                return true/*isHandled*/;

            default:
                _._writer.reply({
                    replyId: message.id,
                    result: false
                });
                return false/*isHandled*/;
        }
    }


    _miningSubscribe(message) {
        const _ = this;

        if (_._client.isSubscribed) {
            _._client.disconnect('Subscribed but already subscribed');
            return true/*isHandled*/;
        }

        _._client.isSubscribed = true;

        // send subscribe response
        _._writer.replySubscribe({
            replyId: message.id
        });

        return true/*isHandled*/;
    }


    _miningAuthorize(message) {

        const _ = this;

        const workerName = message.params[0];
        if (!workerName || !mu.isString(workerName)) {

            _._writer.reply({
                replyId: message.id,
                error: StratumError.UNAUTHORIZED_WORKER,
            });
            return true/*isHandled*/;
        }

        _._client.workerName = workerName;

        _._stratum.canAuthorizeWorker(_._client, (err, isAuthorized) => {

            if (err) {
                _._client.disconnect('Error while authorizing');
                return;
            }

            _._writer.reply({
                replyId: message.id,
                result: isAuthorized,
                error: isAuthorized ? null : StratumError.UNAUTHORIZED_WORKER
            });

            if (isAuthorized) {
                _._client.isAuthorized = true; // setting this triggers event
                _._client.setJob({
                    job: _._stratum.jobManager.currentJob,
                    isNewBlock: true
                });
            }
        });

        return true/*isHandled*/;
    }


    _miningSubmit(message) {
        const _ = this;

        if (!_._client.isAuthorized) {
            _._writer.reply({
                replyId: message.id,
                error: StratumError.UNAUTHORIZED_WORKER
            });
            return true/*isHandled*/;
        }

        if (!_._client.isSubscribed) {
            _._writer.reply({
                replyId: message.id,
                error: StratumError.NOT_SUBSCRIBED
            });
            return true/*isHandled*/;
        }

        if (!Array.isArray(message.params)) {
            _._client.disconnect('Malformed message: params is not an array');
            return true/*isHandled*/;
        }

        const workerName = message.params[0];
        const jobIdBuf = message.params[1];
        const extraNonce2Buf = message.params[2];
        const nTimeBuf = message.params[3];
        const nonceBuf = message.params[4];
        const mtpHashRootBuf = message.params[5];
        const mtpBlockBuf = message.params[6];
        const mtpProofBuf = message.params[7];

        if (!Buffer.isBuffer(jobIdBuf)) {
            _._client.disconnect('Malformed message: jobIdBuf is not a Buffer');
            return true/*isHandled*/;
        }

        if (!Buffer.isBuffer(extraNonce2Buf)) {
            _._client.disconnect('Malformed message: extraNonce2Buf is not a Buffer');
            return true/*isHandled*/;
        }

        if (!Buffer.isBuffer(nTimeBuf)) {
            _._client.disconnect('Malformed message: nTimeBuf is not a Buffer');
            return true/*isHandled*/;
        }

        if (!Buffer.isBuffer(nonceBuf)) {
            _._client.disconnect('Malformed message: nonceBuf is not a Buffer');
            return true/*isHandled*/;
        }

        if (!Buffer.isBuffer(mtpHashRootBuf)) {
            _._client.disconnect('Malformed message: mtpHashRootBuf is not a Buffer');
            return true/*isHandled*/;
        }

        if (!Buffer.isBuffer(mtpBlockBuf)) {
            _._client.disconnect('Malformed message: mtpBlockBuf is not a Buffer');
            return true/*isHandled*/;
        }

        if (!Buffer.isBuffer(mtpProofBuf)) {
            _._client.disconnect('Malformed message: mtpProofBuf is not a Buffer');
            return true/*isHandled*/;
        }

        const share = new Share({
            client: _._client,
            stratum: _._stratum,
            workerName: workerName,
            jobIdHex: buffers.leToHex(jobIdBuf),
            extraNonce2Buf: extraNonce2Buf,
            nTimeBuf: nTimeBuf,
            nonceBuf: nonceBuf,
            mtpHashRootBuf: mtpHashRootBuf,
            mtpBlockBuf: mtpBlockBuf,
            mtpProofBuf: mtpProofBuf
        });

        const isValid = share.validate();

        _._stratum.submitShare(_._client, share);

        _._writer.reply({
            replyId: message.id,
            result: isValid,
            error: share.error
        });

        return true/*isHandled*/;
    }
}

module.exports = ClientReader;