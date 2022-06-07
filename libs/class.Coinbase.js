'use strict';

const
    scripts = require('@mintpond/mint-bitcoin-script'),
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    buffers = require('@mintpond/mint-utils').buffers,
    Share = require('./class.Share');

const
    EXTRANONCE_SIZE = 4,
    BUFFER_U32_ZERO = buffers.packUInt32LE(0),
    BUFFER_VAR_ONE = buffers.packVarInt(1),
    BUFFER_32_MAX = Buffer.from('FFFFFFFF', 'hex'),
    BUFFER_TX_VERSION_3 = Buffer.from('03000500', 'hex'),
    BUFFER_INPUT_HASH = buffers.packUInt256LE(0);


class Coinbase {

    /**
     * Constructor.
     *
     * @param args
     * @param args.coinbaseAddress {string}
     * @param args.blockTemplate {object}
     * @param args.chainParams {object}
     * @param [args.blockBrand] {string}
     */
    constructor(args) {
        precon.string(args.coinbaseAddress, 'coinbaseAddress');
        precon.notNull(args.blockTemplate, 'blockTemplate');
        precon.notNull(args.chainParams, 'chainParams');
        precon.opt_string(args.blockBrand, 'blockBrand');

        const _ = this;
        _._coinbaseAddress = args.coinbaseAddress;
        _._blockTemplate = args.blockTemplate;
        _._chainParams = args.chainParams;
        _._blockBrand = args.blockBrand || '/@mintpond/ref-stratum/'

        _._coinbase1 = null;
        _._coinbase2 = null;
        _._outputCount = 0;
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
     * Use information from a client to serialize coinbase.
     *
     * @param client {Client}
     * @returns {Buffer}
     */
    serialize(client) {
        precon.notNull(client, 'client');

        const _ = this;
        const coinbase1Buf = _.coinbase1Buf;
        const coinbase2Buf = _.coinbase2Buf;
        return Buffer.concat([
            coinbase1Buf,
            Buffer.from(client.extraNonce1Hex, 'hex'),
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

            /* version       */ BUFFER_TX_VERSION_3,

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
        const outputsBuf = _._createOutputsBuf();

        // Second part of coinbase which is split at the extra nonce values
        return Buffer.concat([

            // ...
            /* block branding */ _._blockBrandBuf,
            /* input sequence */ BUFFER_32_MAX,

            // Tx Outputs
            /* output count   */ buffers.packVarInt(_._outputCount),
            /* outputs        */ outputsBuf,

            /* lock time      */ BUFFER_U32_ZERO,
            /* extra_payload  */ _._getExtraPayloadBuf()
        ]);
    }


    _createOutputsBuf() {

        const _ = this;
        const outputsArr = [];
        const blockTemplate = _._blockTemplate;
        const poolAddressScript = scripts.makeAddressScript(_._coinbaseAddress)
        const isTestnet = _._chainParams.isTestnet;

        let poolRewardSt = blockTemplate.coinbasevalue;

        _._outputCount = 0;

        const time = mu.now(); // epoch time in seconds

        if (time >= _._chainParams.stage3StartTime) {

            const coin = _._chainParams.COIN;

            const devFundSt = _._chainParams.stage3DevelopmentFund * coin;
            const commFundSt = _._chainParams.stage3CommunityFund * coin;

            const devFundScript = scripts.makeAddressScript(_._chainParams.stage3DevelopmentFundAddress);
            const commFundScript = scripts.makeAddressScript(_._chainParams.stage3CommunityFundAddress);

            _._addOutput(outputsArr, devFundSt, devFundScript);
            _._addOutput(outputsArr, commFundSt, commFundScript);
        }
        else if (blockTemplate.height < _._chainParams.nSubsidyHalvingFirst) {

            const coin = _._chainParams.COIN;

            const founder1RewardSt = 1 * coin;
            const founder2RewardSt = 1 * coin;
            const founder3RewardSt = 1 * coin;
            const founder4RewardSt = 3 * coin;
            const founder5RewardSt = 1 * coin;

            const founder1Script = scripts.makeAddressScript(
                isTestnet ? 'TDk19wPKYq91i18qmY6U9FeTdTxwPeSveo' : 'aCAgTPgtYcA4EysU4UKC86EQd5cTtHtCcr');

            const founder2Script = scripts.makeAddressScript(
                isTestnet ? 'TWZZcDGkNixTAMtRBqzZkkMHbq1G6vUTk5' : 'aHu897ivzmeFuLNB6956X6gyGeVNHUBRgD');

            const founder3Script = scripts.makeAddressScript(
                isTestnet ? 'TRZTFdNCKCKbLMQV8cZDkQN9Vwuuq4gDzT' : 'aQ18FBVFtnueucZKeVg4srhmzbpAeb1KoN');

            const founder4Script = scripts.makeAddressScript(
                isTestnet ? 'TG2ruj59E5b1u9G3F7HQVs6pCcVDBxrQve' : 'a1HwTdCmQV3NspP2QqCGpehoFpi8NY4Zg3');

            const founder5Script = scripts.makeAddressScript(
                isTestnet ? 'TCsTzQZKVn4fao8jDmB9zQBk9YQNEZ3XfS' : 'a1kCCGddf5pMXSipLVD9hBG2MGGVNaJ15U');

            _._addOutput(outputsArr, founder1RewardSt, founder1Script);
            _._addOutput(outputsArr, founder2RewardSt, founder2Script);
            _._addOutput(outputsArr, founder3RewardSt, founder3Script);
            _._addOutput(outputsArr, founder4RewardSt, founder4Script);
            _._addOutput(outputsArr, founder5RewardSt, founder5Script);
        }
        else {

            const devFundSt = 187500000;
            const devFundScript = scripts.makeAddressScript(
                isTestnet
                    ? 'TUuKypsbbnHHmZ2auC2BBWfaP1oTEnxjK2'
                    : 'aFrAVZFr8pva5mG8XKaUH8EXcFVVNxLiuB');

            _._addOutput(outputsArr, devFundSt, devFundScript);
        }

        /* DEV FEE START */
        const feeRewardSt = Math.round(poolRewardSt * 0.0025/*0.25%*/);
        poolRewardSt -= feeRewardSt;

        const feeScript = scripts.makeAddressScript(
            isTestnet
                ? 'TC6qME2GhepR7656DgsR72pkQDmhfTDbtV'
                : 'aMaQErBviQDyXBPuh4cq6FBCnXhpVWiXT4');

        _._addOutput(outputsArr, feeRewardSt, feeScript);
        /* DEV FEE END */

        _._addOutput(outputsArr, poolRewardSt, poolAddressScript);

        const znode = blockTemplate.znode;

        // Evo Znodes
        znode.forEach(entry => {
            _._addOutput(outputsArr, entry.amount, scripts.makeAddressScript(entry.payee));
        });

        return Buffer.concat(outputsArr);
    }


    _addOutput(outputsBufArr, rewardSt, scriptBuff) {
        const _ = this;
        outputsBufArr.push(
            buffers.packUInt64LE(rewardSt),
            buffers.packVarInt(scriptBuff.length),
            scriptBuff
        );
        _._outputCount++;
    }


    _getExtraPayloadBuf() {

        const _ = this;

        if (!_._blockTemplate.coinbase_payload)
            return Buffer.alloc(1, 0);

        const payload = Buffer.from(_._blockTemplate.coinbase_payload, 'hex');
        const cbPayload = Buffer.alloc(1 + payload.length);

        cbPayload.writeUInt8(payload.length, 0);
        payload.copy(cbPayload, 1);

        return cbPayload;
    }
}

module.exports = Coinbase;