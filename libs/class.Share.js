'use strict';

const
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    buffers = require('@mintpond/mint-utils').buffers,
    bi = require('@mintpond/mint-utils').bi,
    algorithm = require('./service.algorithm'),
    StratumError = require('./class.StratumError');


const MTP_HASH_VALUE_BUFFER = Buffer.alloc(32, 0);

const MTP_VERIFY_FAILED = StratumError.custom('MTP verify failed');
const INCORRECT_HASH_ROOT_SIZE = StratumError.custom('Incorrect size of MTP hash root');
const INCORRECT_BLOCK_SIZE = StratumError.custom('Incorrect size of MTP block');


class Share {

    /**
     * Constructor.
     *
     * @param args
     * @param args.client {Client}
     * @param args.stratum {Stratum}
     * @param args.workerName {string}
     * @param args.jobIdHex {string}
     * @param args.extraNonce2Buf {string}
     * @param args.nTimeBuf {string}
     * @param args.nonceBuf {string}
     * @param args.mtpHashRootBuf {Buffer}
     * @param args.mtpBlockBuf {Buffer}
     * @param args.mtpProofBuf {Buffer}
     */
    constructor(args) {
        precon.notNull(args.client, 'client');
        precon.notNull(args.stratum, 'stratum');
        precon.string(args.workerName, 'workerName');
        precon.string(args.jobIdHex, 'jobIdHex');
        precon.buffer(args.extraNonce2Buf, 'extraNonce2Buf');
        precon.buffer(args.nTimeBuf, 'nTimeBuf');
        precon.buffer(args.nonceBuf, 'nonceBuf');
        precon.buffer(args.mtpHashRootBuf, 'mtpHashRootBuf');
        precon.buffer(args.mtpBlockBuf, 'mtpBlockBuf');
        precon.buffer(args.mtpProofBuf, 'mtpProofBuf');

        const _ = this;
        _._client = args.client;
        _._stratum = args.stratum;
        _._workerName = args.workerName;
        _._jobIdHex = args.jobIdHex;
        _._extraNonce2Buf = args.extraNonce2Buf;
        _._nTimeBuf = args.nTimeBuf;
        _._nonceBuf = args.nonceBuf;
        _._mtpHashRootBuf = args.mtpHashRootBuf;
        _._mtpBlockBuf = args.mtpBlockBuf;
        _._mtpProofBuf = args.mtpProofBuf;

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
     * Get share nTime as a Buffer
     * @returns {Buffer}
     */
    get nTimeBuf() { return this._nTimeBuf; }

    /**
     * Get share nonce as a Buffer
     * @returns {Buffer}
     */
    get nonceBuf() { return this._nonceBuf; }

    /**
     * Get client extraNonce1 as a Buffer
     * @returns {Buffer}
     */
    get extraNonce1Buf() { return buffers.hexToLE(this._client.extraNonce1Hex); }

    /**
     * Get share extraNonce2 as a Buffer
     * @returns {Buffer}
     */
    get extraNonce2Buf() { return this._extraNonce2Buf; }


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

        // check nonce size
        if (_._isInvalidNonceSize())
            return false;

        // check extraNonce2 size
        if (_._isInvalidExtraNonce2Size())
            return false;

        // check time size
        if (_._isInvalidTimeSize())
            return false;

        // check time range
        if (_._isInvalidTimeRange())
            return false;

        // check duplicate share
        if (_._isDuplicateShare())
            return false;

        /* check MTP hash root size */
        if (_._mtpHashRootBuf.length !== algorithm.MTP_HASH_ROOT_SIZE) {
            _._setError(INCORRECT_HASH_ROOT_SIZE);
            return true;
        }

        /* check MTP block size */
        if (_._mtpBlockBuf.length !== algorithm.MTP_BLOCK_SIZE) {
            _._setError(INCORRECT_BLOCK_SIZE);
            return true;
        }

        /* Validate MTP proofs */
        const mtpHeaderBuf = _._serializeMtpHeader();

        const isValidProof = algorithm.verify(
            /* header    */ mtpHeaderBuf,
            /* nonce     */ _._nonceBuf,
            /* hash root */ _._mtpHashRootBuf,
            /* mtp block */ _._mtpBlockBuf,
            /* mtp proof */ _._mtpProofBuf,
            /* hash out  */ MTP_HASH_VALUE_BUFFER);

        if (!isValidProof) {
            _._setError(MTP_VERIFY_FAILED);
            return true;
        }

        // check valid block
        const header = _._validateBlock(MTP_HASH_VALUE_BUFFER);

        if (_._isValidBlock) {

            _._blockHex = _._serializeBlock(header).toString('hex');
            _._blockId = header.hash.toString('hex');

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
        if (_._nonceBuf.length !== 4) {
            _._setError(StratumError.INCORRECT_NONCE_SIZE);
            return true;
        }
        return false;
    }


    _isInvalidExtraNonce2Size() {
        const _ = this;
        if (_._extraNonce2Buf.length !== 8) {
            _._setError(StratumError.INCORRECT_EXTRANONCE2_SIZE);
            return true;
        }
        return false;
    }


    _isInvalidTimeSize() {
        const _ = this;
        if (_._nTimeBuf.length !== 4) {
            _._setError(StratumError.INCORRECT_TIME_SIZE);
            return true;
        }
        return false;
    }


    _isInvalidTimeRange() {
        const _ = this;
        const nTimeInt = _._nTimeBuf.readUInt32LE(0);
        if (nTimeInt < _._job.blockTemplate.curtime || nTimeInt > _._submitTime + 7200) {
            _._setError(StratumError.TIME_OUT_OF_RANGE);
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


    _validateBlock(mtpHashValueBuf) {
        const _ = this;

        const headerBi = bi.fromBufferLE(mtpHashValueBuf);

        _._shareDiff = algorithm.diff1 / Number(headerBi) * algorithm.multiplier;
        _._isValidBlock = _._job.targetBi >= headerBi;

        return _._isValidBlock ? _._serializeHeader(mtpHashValueBuf) : null;
    }


    _serializeHeader(mtpHashValueBuf) {
        const _ = this;

        const coinbaseBuf = _._job.coinbase.serialize(_);
        const coinbaseHashBuf = buffers.sha256d(coinbaseBuf);

        const merkleRootBuf = _._job.merkleTree.withFirstHash(coinbaseHashBuf);

        const headerBuf = Buffer.alloc(180);
        let position = 0;

        /* version    */
        _._job.versionBuf.copy(headerBuf, position);
        position += 4;

        /* prev block */
        _._job.prevHashBuf.copy(headerBuf, position);
        position += 32;

        /* merkle     */
        merkleRootBuf.copy(headerBuf, position);
        position += 32;

        /* time       */
        _._nTimeBuf.copy(headerBuf, position);
        position += 4;

        /* bits       */
        _._job.bitsBuf.copy(headerBuf, position);
        position += 4;

        /* nonce      */
        _._nonceBuf.copy(headerBuf, position);
        position += 4;

        /* MTP version */
        headerBuf.writeUInt32BE(algorithm.MTP_VERSION, position);
        position += 4;

        /* MTP hash value */
        mtpHashValueBuf.copy(headerBuf, position);
        /* +32 bytes */

        /* +32 bytes - MTP reserved[0] */
        /* +32 bytes - MTP reserved[1] */

        return {
            hash: buffers.sha256d(headerBuf),
            buffer: headerBuf,
            coinbaseBuf: coinbaseBuf
        };
    }


    _serializeMtpHeader() {

        const _ = this;

        const coinbaseBuf = _._job.coinbase.serialize(_);
        const coinbaseHashBuf = buffers.sha256d(coinbaseBuf);

        const merkleRootBuf = _._job.merkleTree.withFirstHash(coinbaseHashBuf);

        const headerBuf = Buffer.alloc(80);
        let position = 0;

        /* version     */
        _._job.versionBuf.copy(headerBuf, position);
        position += 4;

        /* prev block  */
        _._job.prevHashBuf.copy(headerBuf, position);
        position += 32;

        /* merkle      */
        merkleRootBuf.copy(headerBuf, position);
        position += 32;

        /* time        */
        _._nTimeBuf.copy(headerBuf, position);
        position += 4;

        /* bits        */
        _._job.bitsBuf.copy(headerBuf, position);
        position += 4;

        /* mtp version */
        headerBuf.writeUInt32BE(algorithm.MTP_VERSION, position);

        return headerBuf;
    }


    _serializeBlock(header) {
        const _ = this;

        return Buffer.concat([
            /* header           */ header.buffer,
            /* mtp hash root    */ _._mtpHashRootBuf,
            /* mtp block        */ _._mtpBlockBuf,
            /* mtp proof        */ _._mtpProofBuf,
            /* transaction len  */ buffers.packVarInt(_._job.blockTemplate.transactions.length + 1/* +coinbase */),
            /* coinbase tx      */ header.coinbaseBuf,
            /* transactions     */ _._job.txDataBuf
        ]);
    }
}

module.exports = Share;