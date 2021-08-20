'use strict';

const
    SHA3 = require('sha3'),
    precon = require('@mintpond/mint-precon'),
    TxMerkleTree = require('@mintpond/mint-merkle').TxMerkleTree,
    mu = require('@mintpond/mint-utils'),
    bi = require('@mintpond/mint-utils').bi,
    buffers = require('@mintpond/mint-utils').buffers,
    algorithm = require('./service.algorithm'),
    Coinbase = require('./class.Coinbase'),
    Share = require('./class.Share');

const BLOCK_HEIGHT_BUFFER = Buffer.alloc(4);
const MIX_HASH_BUFFER = Buffer.alloc(32);


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
        _._versionHex = buffers.packUInt32BE(_._blockTemplate.version).toString('hex');

        _._curTimeBuf = buffers.packUInt32LE(_._blockTemplate.curtime);
        _._curTimeHex = buffers.packUInt32BE(_._blockTemplate.curtime).toString('hex');

        _._bitsBuf = buffers.hexToLE(_._blockTemplate.bits);
        _._bitsHex = _._blockTemplate.bits;

        _._prevHashBuf = buffers.hexToLE(_._blockTemplate.previousblockhash);
        _._prevHashHex = _._blockTemplate.previousblockhash;

        _._coinbase = _._createCoinbase();
        _._merkleTree = _._createMerkleTree();
        _._submitSet = new Set();

        _._txDataBuf = Buffer.concat(_._blockTemplate.transactions.map(tx => {
            return Buffer.from(tx.data, 'hex');
        }));

        _._epochNumber = _._getEpochNumber(_._height);
        _._seedHashBuf = _._createSeedHashBuf();
        _._ppHeaderTemplateBuf = Buffer.alloc(80);

        let position = 0;

        /* version    */
        _.versionBuf.copy(_._ppHeaderTemplateBuf, position);
        position += 4;

        /* prev block   */
        _.prevHashBuf.copy(_._ppHeaderTemplateBuf, position);
        position += 32;

        /* merkle       */
        // reserved for merkle root
        position += 32;

        /* time         */
        _.curTimeBuf.copy(_._ppHeaderTemplateBuf, position);
        position += 4;

        /* bits         */
        _.bitsBuf.copy(_._ppHeaderTemplateBuf, position);
        position += 4;

        /* block height */
        BLOCK_HEIGHT_BUFFER.writeUInt32LE(_.height, 0);
        BLOCK_HEIGHT_BUFFER.copy(_._ppHeaderTemplateBuf, position);
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
     * Get the block template version as a LE buffer.
     * @returns {Buffer}
     */
    get versionBuf() { return this._versionBuf; }

    /**
     * Get the block template version in hex.
     * @returns {string}
     */
    get versionHex() { return this._versionHex; }

    /**
     * Get the block template curtime as a LE buffer.
     * @returns {Buffer}
     */
    get curTimeBuf() { return this._curTimeBuf; }

    /**
     * Get the block template curtime in hex.
     * @returns {string}
     */
    get curTimeHex() { return this._curTimeHex; }

    /**
     * Get the block template bits as a LE buffer.
     * @returns {Buffer}
     */
    get bitsBuf() { return this._bitsBuf; }

    /**
     * Get the block template bits in hex.
     * @returns {string}
     */
    get bitsHex() { return this._bitsHex; }

    /**
     * Get the block template previous block hash as a LE buffer.
     * @returns {Buffer}
     */
    get prevHashBuf() { return this._prevHashBuf; }

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
     * Get the block template transaction data as a LE buffer.
     * @returns {Buffer}
     */
    get txDataBuf() { return this._txDataBuf; }

    /**
     * Get the job epoch number.
     * @returns {number}
     */
    get epochNumber() { return this._epochNumber; }

    /**
     * Get epoch seed hash.
     * @returns {Buffer}
     */
    get seedHashBuf() { return this._seedHashBuf; }


    /**
     * Register a share and check if the share is a duplicate.
     *
     * @param share {Share}
     * @returns {boolean} True if the share is successfully registered, false if it is a duplicate.
     */
    registerShare(share) {
        precon.instanceOf(share, Share, 'share');
        precon.string(share.extraNonce1Hex, 'extraNonce1Hex');
        precon.string(share.nonceHex, 'nonceHex');

        const _ = this;
        const extraNonce1Hex = share.extraNonce1Hex;
        const nonceHex = share.nonceHex;

        const submitId = `${nonceHex}:${extraNonce1Hex}`;

        if (_._submitSet.has(submitId))
            return false;

        _._submitSet.add(submitId);
        return true;
    }


    /**
     * Get header hash used for ProgPow.
     *
     * @param client {Client}
     * @returns {Buffer}
     */
    getProgPowHashBuf(client) {
        precon.notNull(client, 'client');

        const _ = this;
        const coinbaseBuf = _.coinbase.serialize(client);
        const coinbaseHashBuf = buffers.sha256d(coinbaseBuf);
        const merkleRootBuf = _.merkleTree.withFirstHash(coinbaseHashBuf);

        merkleRootBuf.copy(_._ppHeaderTemplateBuf, 36);

        return buffers.reverseBytes(buffers.sha256d(_._ppHeaderTemplateBuf));
    }


    /**
     * Get header hash used for block ID.
     *
     * @param share {Share}
     * @returns {Buffer}
     */
    getHeaderHashBuf(share) {
        precon.instanceOf(share, Share, 'share');

        const _ = this;
        const coinbaseBuf = _.coinbase.serialize(share.client);
        const coinbaseHashBuf = buffers.sha256d(coinbaseBuf);
        const merkleRootBuf = _.merkleTree.withFirstHash(coinbaseHashBuf);

        const headerBuf = Buffer.alloc(120);

        _._ppHeaderTemplateBuf.copy(headerBuf);

        merkleRootBuf.copy(headerBuf, 36);
        share.nonceBuf.copy(headerBuf, 80);
        buffers.reverseBytes(share.mixHashBuf, MIX_HASH_BUFFER).copy(headerBuf, 88);

        return buffers.reverseBytes(buffers.sha256d(headerBuf));
    }


    /**
     * Serialize header using share data.
     *
     * @param share {Share}
     * @returns {{coinbaseBuf: Buffer, buffer: Buffer}}
     */
    serializeHeader(share) {
        precon.instanceOf(share, Share, 'share');

        const _ = this;

        const coinbaseBuf = _.coinbase.serialize(share.client);
        const coinbaseHashBuf = buffers.sha256d(coinbaseBuf);
        const merkleRootBuf = _.merkleTree.withFirstHash(coinbaseHashBuf);

        const headerBuf = Buffer.alloc(80);
        _._ppHeaderTemplateBuf.copy(headerBuf);

        merkleRootBuf.copy(headerBuf, 36);

        return {
            buffer: headerBuf,
            coinbaseBuf: coinbaseBuf
        };
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
            blockBrand: _._stratum.config.blockBrand,
            chainParams: _._stratum.config.chainParams
        });
    }


    _getEpochNumber(blockHeight) {
        return Math.floor(blockHeight / algorithm.epochLen);
    }


    _createSeedHashBuf() {
        const _ = this;
        let sha3 = null;
        let seedHashBuf = Buffer.alloc(32, 0);
        for (let i = 0; i < _.epochNumber; i++) {
            sha3 = new SHA3.SHA3Hash(256);
            sha3.update(seedHashBuf);
            seedHashBuf = sha3.digest();
        }
        return seedHashBuf;
    }
}

module.exports = Job;