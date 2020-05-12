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
        _._prevBlockId = _._getPrevBlockId();
        _._height = _._blockTemplate.height;

        _._targetBi = _._blockTemplate.target
            ? BigInt('0x' + _._blockTemplate.target)
            : bi.fromBitsHex(_._blockTemplate.bits);

        _._nDiff = algorithm.diff1 / Number(_._targetBi);
        _._pDiff = _._nDiff * algorithm.multiplier;

        _._versionHex = _._blockTemplate.version;
        _._curTimeHex = buffers.packUInt32LE(_._blockTemplate.curtime).toString('hex');
        _._bitsHex = _._blockTemplate.bits;
        _._prevHashHex = _._blockTemplate.previousblockhash;

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
     * Get the block template version in hex.
     * @returns {string}
     */
    get versionHex() { return this._versionHex; }

    /**
     * Get the block template curtime in hex.
     * @returns {string}
     */
    get curTimeHex() { return this._curTimeHex; }

    /**
     * Get the block template bits in hex.
     * @returns {string}
     */
    get bitsHex() { return this._bitsHex; }

    /**
     * Get the block template previous block hash in hex.
     * @returns {string}
     */
    get prevHashHex() { return this._prevHashHex; }

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
        precon.string(share.extraNonce1Hex, 'extraNonce1Hex');
        precon.string(share.extraNonce2Hex, 'extraNonce2Hex');
        precon.string(share.nTimeHex, 'nTimeHex');
        precon.string(share.nonceHex, 'nonceHex');

        const _ = this;
        const extraNonce1Hex = share.extraNonce1Hex;
        const extraNonce2Hex = share.extraNonce2Hex;
        const nTimeHex = share.nTimeHex;
        const nonceHex = share.nonceHex;

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


    _getPrevBlockId() {
        const _ = this;
        return buffers.leToHex(buffers.reverseDWords(Buffer.from(_._blockTemplate.previousblockhash, 'hex')));
    }
}

module.exports = Job;