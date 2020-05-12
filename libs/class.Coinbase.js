'use strict';

const
    scripts = require('@mintpond/mint-bitcoin-script'),
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    buffers = require('@mintpond/mint-utils').buffers,
    Share = require('./class.Share');

const
    EXTRANONCE_SIZE = 8,
    BUFFER_U32_ZERO = buffers.packUInt32LE(0),
    BUFFER_VAR_ONE = buffers.packVarInt(1),
    BUFFER_32_MAX = Buffer.from('FFFFFFFF', 'hex'),
    BUFFER_TX_VERSION_1 = buffers.packUInt32LE(1),
    BUFFER_INPUT_HASH = buffers.packUInt256LE(0);


class Coinbase {

    /**
     * Constructor.
     *
     * @param args
     * @param args.coinbaseAddress {string}
     * @param args.blockTemplate {object}
     * @param [args.blockBrand] {string}
     */
    constructor(args) {
        precon.string(args.coinbaseAddress, 'coinbaseAddress');
        precon.notNull(args.blockTemplate, 'blockTemplate');
        precon.opt_string(args.blockBrand, 'blockBrand');

        const _ = this;
        _._coinbaseAddress = args.coinbaseAddress;
        _._blockTemplate = args.blockTemplate;
        _._blockBrand = args.blockBrand || '/@mintpond/ref-stratum/'

        _._coinbase1 = null;
        _._coinbase2 = null;
        _._txCount = 0;
        _._time = mu.now();

        _._blockBrandBuf = scripts.serializeString(_._blockBrand)
    }


    /**
     * Get the first part of the serialized coinbase.
     * @returns {Buffer}
     */
    get coinbase1Buf() { return this._coinbase1 || (this._coinbase1 = this._createCoinbase1()); }

    /**
     * Get the seconds part of the serialized coinbase.
     * @returns {Buffer}
     */
    get coinbase2Buf() { return this._coinbase2 || (this._coinbase2 = this._createCoinbase2()); }


    /**
     * Use information from a share to serialize coinbase.
     *
     * @param share {Share}
     * @returns {Buffer}
     */
    serialize(share) {
        precon.instanceOf(share, Share, 'share');

        const _ = this;
        const coinbase1Buf = _.coinbase1Buf;
        const coinbase2Buf = _.coinbase2Buf;
        return Buffer.concat([
            coinbase1Buf,
            Buffer.from(share.extraNonce1Hex, 'hex'),
            Buffer.from(share.extraNonce2Hex, 'hex'),
            coinbase2Buf
        ]);
    }


    _createCoinbase1() {

        const _ = this;
        const inputScript = Buffer.concat([
            /* block height      */ scripts.serializeNumber(_._blockTemplate.height),
            /* flags             */ Buffer.from(_._blockTemplate.coinbaseaux.flags, 'hex'),
            /* time              */ scripts.serializeNumber(_._time),
            /* extranonce length */ Buffer.from([EXTRANONCE_SIZE])
        ]);

        const inputScriptLen = inputScript.length + EXTRANONCE_SIZE + _._blockBrandBuf.length;

        // First part of coinbase which is split at the extra nonce values
        return Buffer.concat([

            /* version       */ BUFFER_TX_VERSION_1,

            // Tx Inputs
            /* input count   */ BUFFER_VAR_ONE,
            /* input tx hash */ BUFFER_INPUT_HASH,
            /* input vout    */ BUFFER_32_MAX,
            /* input scr len */ buffers.packVarInt(inputScriptLen),
            /* input scr     */ inputScript
            // ...
        ]);
    }


    _createCoinbase2() {
        const _ = this;
        /*
         The generation transaction must be split at the extranonce (which is located in the transaction input
         scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
         a valid share and/or block.
         */
        const outputTxBuf = _._createOutputTxsBuf();

        // Second part of coinbase which is split at the extra nonce values
        return Buffer.concat([

            // ...
            /* block branding */ _._blockBrandBuf,
            /* input sequence */ BUFFER_32_MAX,

            // Tx Outputs
            /* output count   */ buffers.packVarInt(_._txCount),
            /* outputs        */ outputTxBuf,

            /* lock time      */ BUFFER_U32_ZERO
        ]);
    }


    _createOutputTxsBuf() {

        const _ = this;
        const outputTxsArr = [];
        const blockTemplate = _._blockTemplate;
        const poolAddressScript = scripts.makeAddressScript(_._coinbaseAddress)

        let poolRewardSt = blockTemplate.coinbasevalue;
        _._txCount = 0;

        _._addTransaction(outputTxsArr, poolRewardSt, poolAddressScript, true);

        const default_witness_commitment = blockTemplate.default_witness_commitment;
        if (default_witness_commitment) {

            const witnessCommitmentBuf = Buffer.from(default_witness_commitment, 'hex');

            _._addTransaction(outputTxsArr, 0, witnessCommitmentBuf);
        }

        return Buffer.concat(outputTxsArr);
    }


    _addTransaction(txOutputBuffersArr, rewardSt, scriptBuff) {
        const _ = this;
        txOutputBuffersArr.push(
            buffers.packUInt64LE(rewardSt),
            buffers.packVarInt(scriptBuff.length),
            scriptBuff
        );
        _._txCount++;
    }
}

module.exports = Coinbase;