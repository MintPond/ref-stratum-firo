'use strict';

const
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    buffers = require('@mintpond/mint-utils').buffers,
    bi = require('@mintpond/mint-utils').bi,
    algorithm = require('./service.algorithm'),
    StratumError = require('./class.StratumError');

const NONCE_SIZE = 8;
const HEADER_HASH_SIZE = 32;
const MIX_HASH_SIZE = 32;
const HASH_OUT_BUFFER = Buffer.alloc(32);
const MIX_HASH_BUFFER = Buffer.alloc(32);


class Share {

    /**
     * Constructor.
     *
     * @param args
     * @param args.client {Client}
     * @param args.stratum {Stratum}
     * @param args.workerName {string}
     * @param args.jobIdHex {string}
     * @param args.nonceBuf {Buffer}
     * @param args.headerHashBuf {Buffer}
     * @param args.mixHashBuf {Buffer}
     */
    constructor(args) {
        precon.notNull(args.client, 'client');
        precon.notNull(args.stratum, 'stratum');
        precon.string(args.workerName, 'workerName');
        precon.string(args.jobIdHex, 'jobIdHex');
        precon.buffer(args.nonceBuf, 'nonceBuf');
        precon.buffer(args.headerHashBuf, 'headerHashBuf');
        precon.buffer(args.mixHashBuf, 'mixHashBuf');

        const _ = this;
        _._client = args.client;
        _._stratum = args.stratum;
        _._workerName = args.workerName;
        _._jobIdHex = args.jobIdHex;
        _._nonceBuf = args.nonceBuf;
        _._headerHashBuf = args.headerHashBuf;
        _._mixHashBuf = args.mixHashBuf;

        _._nonceHex = buffers.leToHex(_._nonceBuf);
        _._stratumDiff = _._client.diff;
        _._shareDiff = 0;
        _._expectedBlocks = 0;

        _._submitTime = mu.now();
        _._job = null;
        _._isValidShare = null;
        _._isValidBlock = false;
        _._isBlockAccepted = false;
        _._error = null;
        _._blockId = null;
        _._blockHex = null;
        _._blockTxId = null;

        _._minerAddress = _._workerName.split('.');
    }

    /**
     * Get the client that submitted the share.
     * @returns {Client}
     */
    get client() { return this._client; }

    /**
     * Get the job ID of the share.
     * @returns {string}
     */
    get jobIdHex() { return this._jobIdHex; }

    /**
     * Get the job height of the share.
     * This value is not available until a job has been associated with the share via the #validate function.
     * @returns {number}
     */
    get jobHeight() { return this._job ? this._job.height : 0; }

    /**
     * Get the time of the share submission in epoch seconds.
     * @returns {number}
     */
    get submitTime() { return this._submitTime; }

    /**
     * Get the subscription ID of the client that submitted the share.
     * @returns {string}
     */
    get subscriptionIdHex() { return this._client.subscriptionIdHex; }

    /**
     * Get the mining address of the client that submitted the share.
     * @returns {string}
     */
    get minerAddress() { return this._client.minerAddress; }

    /**
     * Get the share difficulty.
     * This value is not available until it is calculated in the #validate function.
     * @returns {number}
     */
    get shareDiff() { return this._shareDiff; }

    /**
     * Get the stratum difficulty of the share.
     * @returns {number}
     */
    get stratumDiff() { return this._stratumDiff; }

    /**
     * Get the expected blocks of the share.
     * This value is not available until it is calculated in the #validate function.
     * @returns {number}
     */
    get expectedBlocks() { return this._expectedBlocks; }

    /**
     * Determine if the share is a valid block.
     * This value is not available until it is calculated in the #validate function.
     * @returns {boolean}
     */
    get isValidBlock() { return this._isValidBlock; }
    set isValidBlock(isValid) {
        precon.boolean(isValid, 'isValidBlock');
        this._isValidBlock = isValid;
    }

    /**
     * Determine if the share is valid.
     * This value is not available until it is calculated in the #validate function.
     * @returns {boolean}
     */
    get isValidShare() { return this._isValidShare; }

    /**
     * Determine if the share as a block was accepted by the coin daemon.
     * This value is not available until the block transaction id is set via the #blockTxId property.
     * @returns {boolean}
     */
    get isBlockAccepted() { return this._isBlockAccepted; }

    /**
     * Get the stratum error of the share.
     * This value is not available until it is calculated in the #validate function.
     * @returns {null|StratumError}
     */
    get error() { return this._error; }

    /**
     * Get the block hex data to submit to the coin daemon.
     * This value is not available until it is calculated in the #validate function and only when the share is a valid
     * block.
     * @returns {null|string}
     */
    get blockHex() { return this._blockHex; }

    /**
     * Get the block ID of the valid block.
     * This value is not available until it is calculated in the #validate function and only when the share is a valid
     * block.
     * @returns {null|string}
     */
    get blockId() { return this._blockId; }

    /**
     * Get the block coinbase transaction ID.
     * This value is only available when it is externally set.
     * @returns {null|string}
     */
    get blockTxId() { return this._blockTxId; }
    set blockTxId(txId) {
        precon.opt_string(txId, 'blockTxId');
        this._blockTxId = txId;
        this._isBlockAccepted = !!txId;
    }

    /**
     * Get share nonce as a Buffer
     * @returns {Buffer}
     */
    get nonceHex() { return this._nonceHex; }

    /**
     * Get client extraNonce1 as a Buffer
     * @returns {Buffer}
     */
    get extraNonce1Hex() { return this._client.extraNonce1Hex; }

    /**
     * Get share nonce as a Buffer
     * @returns {Buffer}
     */
    get nonceBuf() { return this._nonceBuf; }

    /**
     * Get header hash
     * @returns {Buffer}
     */
    get headerHashBuf() { return this._headerHashBuf; }

    /**
     * Get Mix hash
     * @returns {Buffer}
     */
    get mixHashBuf() { return this._mixHashBuf; }


    /**
     * Validate the share.
     *
     * @returns {boolean} True if validated. False if the share is invalid.
     */
    validate() {
        const _ = this;

        if (mu.isBoolean(_._isValidShare))
            return _._isValidShare;

        // check worker name mismatch
        if (_._workerName !== _._client.workerName)
            return _._setError(StratumError.UNAUTHORIZED_WORKER);

        _._job = _._stratum.jobManager.validJobsOMap[_._jobIdHex];

        // check valid job
        if (!_._job)
            return _._setError(StratumError.STALE_SHARE);

        // check duplicate share
        if (_._isDuplicateShare())
            return false;

        // check nonce size
        if (_._isInvalidNonceSize())
            return false;

        // check nonce prefix
        if (_._isInvalidNoncePrefix())
            return false;

        if (_._isInvalidHashHeaderSize())
            return false;

        if (_._isInvalidMixHeaderSize())
            return false;

        const headerHashBuf = _._job.getHeaderHashBuf(_._client);

        if (_._isHeaderMismatched(headerHashBuf, _._headerHashBuf))
            return false;

        const isValid = algorithm.verify(
            /* header hash */ headerHashBuf,
            /* nonce       */ _._nonceBuf,
            /* height      */ _._job.height,
            /* mix hash    */ _._mixHashBuf,
            /* hash output */ HASH_OUT_BUFFER);

        if (!isValid)
            return _._setError(StratumError.PROGPOW_VERIFY_FAILED);

        // check valid block
        const hashBi = bi.fromBufferBE(HASH_OUT_BUFFER);
        _._shareDiff = algorithm.diff1 / Number(hashBi) * algorithm.multiplier;
        _._isValidBlock = _._job.targetBi >= hashBi;

        if (_._isValidBlock) {

            _._blockHex = _._serializeBlock().toString('hex');
            _._blockId = HASH_OUT_BUFFER.toString('hex');

            console.log(`Winning nonce submitted: ${_._blockId}`);
        }

        // check low difficulty
        if (!_._error && _._isLowDifficulty())
            return false;

        // calculate expected blocks
        if (_._isValidShare !== false)
            _._expectedBlocks = _._calculateExpectedBlocks();

        return mu.isBoolean(_._isValidShare)
            ? _._isValidShare
            : (_._isValidShare = true);
    }


    toJSON() {
        const _ = this;
        return {
            jobId: _.jobIdHex,
            jobHeight: _.jobHeight,
            submitTime: _.submitTime,
            subscriptionIdHex: _.subscriptionIdHex,
            minerAddress: _.minerAddress,
            workerName: _._workerName,
            shareDiff: _.shareDiff,
            stratumDiff: _.stratumDiff,
            expectedBlocks: _.expectedBlocks,
            isValidBlock: _.isValidBlock,
            isValidShare: _.isValidShare,
            isBlockAccepted: _.isBlockAccepted,
            nonceHex: _.nonceHex,
            error: _.error,
            blockHex: _.blockHex,
            blockId: _.blockId,
            blockTxId: _.blockTxId
        };
    }


    _calculateExpectedBlocks() {
        const _ = this;
        return _._stratumDiff / _._job.pDiff;
    }


    _isInvalidNonceSize() {
        const _ = this;
        if (_._nonceBuf.length !== NONCE_SIZE) {
            _._setError(StratumError.INCORRECT_NONCE_SIZE);
            return true;
        }
        return false;
    }


    _isDuplicateShare() {
        const _ = this;
        if (!_._job.registerShare(_)) {
            _._setError(StratumError.DUPLICATE_SHARE);
            return true;
        }
        return false;
    }


    _isInvalidNoncePrefix() {
        const _ = this;
        const prefixBuf = buffers.hexToLE(_.client.extraNonce1Hex);
        const prefix2Buf = _._nonceBuf.slice(-prefixBuf.length);
        if (Buffer.compare(prefixBuf, prefix2Buf) !== 0) {
            _._setError(StratumError.INCORRECT_NONCE_PREFIX);
            return true;
        }
        return false;
    }


    _isInvalidHashHeaderSize() {
        const _ = this;
        if (_._headerHashBuf.length !== HEADER_HASH_SIZE) {
            _._setError(StratumError.PROGPOW_INCORRECT_HEADER_HASH_SIZE);
            return true;
        }
        return false;
    }


    _isInvalidMixHeaderSize() {
        const _ = this;
        if (_._mixHashBuf.length !== MIX_HASH_SIZE) {
            _._setError(StratumError.PROGPOW_INCORRECT_MIX_HASH_SIZE);
            return true;
        }
        return false;
    }


    _isHeaderMismatched(headerHashBuf, shareHeaderHashBuf) {
        const _ = this;
        if (headerHashBuf.compare(shareHeaderHashBuf) !== 0) {
            _._setError(StratumError.PROGPOW_HEADER_HASH_MISMATCH);
            return true;
        }
        return false;
    }


    _isLowDifficulty() {
        const _ = this;
        const diffFactor = _._shareDiff / _._stratumDiff;
        if (diffFactor < 0.999) {
            _._setError(StratumError.LOW_DIFFICULTY);
            return true;
        }
        return false;
    }


    _setError(error) {
        precon.notNull(error, 'error');

        const _ = this;
        _._error = error;
        return _._isValidShare = false;
    }


    _serializeBlock() {
        const _ = this;
        const header = _._job.serializeHeader(_);

        return Buffer.concat([
            /* header           */ header.buffer,
            /* nonce            */ _._nonceBuf,
            /* mix hash         */ buffers.reverseBytes(_._mixHashBuf, MIX_HASH_BUFFER),
            /* transaction len  */ buffers.packVarInt(_._job.blockTemplate.transactions.length + 1/* +coinbase */),
            /* coinbase tx      */ header.coinbaseBuf,
            /* transactions     */ _._job.txDataBuf
        ]);
    }
}

module.exports = Share;