'use strict';

const
    precon = require('@mintpond/mint-precon'),
    TxMerkleTree = require('@mintpond/mint-merkle').TxMerkleTree,
    mu = require('@mintpond/mint-utils'),
    bi = require('@mintpond/mint-utils').bi,
    buffers = require('@mintpond/mint-utils').buffers,
    algorithm = require('./service.algorithm'),
    Coinbase = require('./class.Coinbase'),
    Share = require('./class.Share');


class Job {

    /**
     * Constructor.
     *
     * @param args
     * @param args.idHex {string}
     * @param args.blockTemplate {object}
     * @param args.stratum {Stratum}
     */
    constructor(args) {
        precon.string(args.idHex, 'idHex');
        precon.notNull(args.blockTemplate, 'blockTemplate');
        precon.notNull(args.stratum, 'stratum');

        const _ = this;
        _._idHex = args.idHex;
        _._blockTemplate = args.blockTemplate;
        _._stratum = args.stratum;

        _._time = mu.now();
        _._prevBlockId = _._blockTemplate.previousblockhash;
        _._height = _._blockTemplate.height;

        _._targetBi = _._blockTemplate.target
            ? BigInt('0x' + _._blockTemplate.target)
            : bi.fromBitsHex(_._blockTemplate.bits);

        _._nDiff = algorithm.diff1 / Number(_._targetBi);
        _._pDiff = _._nDiff * algorithm.multiplier;

        _._versionBuf = buffers.packUInt32LE(_._blockTemplate.version);
        _._curTimeBuf = buffers.packUInt32LE(_._blockTemplate.curtime);
        _._bitsBuf = buffers.hexToLE(_._blockTemplate.bits);
        _._prevHashBuf = buffers.hexToLE(_._blockTemplate.previousblockhash);

        _._coinbase = _._createCoinbase();
        _._merkleTree = _._createMerkleTree();
        _._submitSet = new Set();

        _._txDataBuf = Buffer.concat(_._blockTemplate.transactions.map(tx => {
            return Buffer.from(tx.data, 'hex');
        }));
    }


    /**
     * Get the job ID.
     * @returns {string}
     */
    get idHex() { return this._idHex; }

    /**
     * Get the ID of the previous block relative to this job.
     * @returns {string}
     */
    get prevBlockId() { return this._prevBlockId; }

    /**
     * Get the Coinbase instance associated with this job.
     * @returns {Coinbase}
     */
    get coinbase() { return this._coinbase; }

    /**
     * Get the time of job instantiation.
     * @returns {number}
     */
    get time() { return this._time; }

    /**
     * Get the block chain height of the job.
     * @returns {number}
     */
    get height() { return this._height; }

    /**
     * Get the network scale difficulty of the job.
     * @returns {number}
     */
    get nDiff() { return this._nDiff; }

    /**
     * Get the pool scale difficulty of the job.
     * @returns {number}
     */
    get pDiff() { return this._pDiff; }

    /**
     * Get the block template retrieved from the coin daemon.
     * @returns {object}
     */
    get blockTemplate() { return this._blockTemplate; }

    /**
     * @returns {TxMerkleTree}
     */
    get merkleTree() { return this._merkleTree; }

    /**
     * Get the block template version in LE Buffer.
     * @returns {string}
     */
    get versionBuf() { return this._versionBuf; }

    /**
     * Get the block template curtime in LE Buffer.
     * @returns {string}
     */
    get curTimeBuf() { return this._curTimeBuf; }

    /**
     * Get the block template bits in LE Buffer.
     * @returns {string}
     */
    get bitsBuf() { return this._bitsBuf; }

    /**
     * Get the block template previous block hash in LE Buffer.
     * @returns {Buffer}
     */
    get prevHashBuf() { return this._prevHashBuf; }

    /**
     * Get the block target
     * @returns {BigInt}
     */
    get targetBi() { return this._targetBi; }

    /**
     * Transaction data.
     * @returns {Buffer}
     */
    get txDataBuf() { return this._txDataBuf; }


    /**
     * Register a share and check if the share is a duplicate.
     *
     * @param share {Share}
     * @returns {boolean} True if the share is successfully registered, false if it is a duplicate.
     */
    registerShare(share) {
        precon.instanceOf(share, Share, 'share');
        precon.buffer(share.extraNonce1Buf, 'extraNonce1Buf');
        precon.buffer(share.extraNonce2Buf, 'extraNonce2Buf');
        precon.buffer(share.nTimeBuf, 'nTimeBuf');
        precon.buffer(share.nonceBuf, 'nonceBuf');

        const _ = this;
        const extraNonce1Hex = share.extraNonce1Buf.toString('hex');
        const extraNonce2Hex = share.extraNonce2Buf.toString('hex');
        const nTimeHex = share.nTimeBuf.toString('hex');
        const nonceHex = share.nonceBuf.toString('hex');

        const submitId = `${nonceHex}:${nTimeHex}${extraNonce1Hex}:${extraNonce2Hex}`;

        if (_._submitSet.has(submitId))
            return false;

        _._submitSet.add(submitId);
        return true;
    }


    _createMerkleTree(){
        const _ = this;
        const txsArr = _._blockTemplate.transactions;
        const txHashesArr = txsArr.map(tx => {
            return buffers.packUInt256LE(tx.txid || tx.hash);
        });
        return new TxMerkleTree(txHashesArr);
    }


    _createCoinbase() {
        const _ = this;
        return new Coinbase({
            coinbaseAddress: _._stratum.config.coinbaseAddress,
            blockTemplate: _._blockTemplate,
            blockBrand: _._stratum.config.blockBrand
        });
    }
}

module.exports = Job;