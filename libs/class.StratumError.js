'use strict';

const
    precon = require('@mintpond/mint-precon'),
    StratumErrorCode = require('./const.StratumErrorCode');


class StratumError {

    /**
     * Constructor.
     *
     * @param errorCode {number} (StratumErrorCode) Error code number
     * @param message {string}
     */
    constructor(errorCode, message) {
        precon.oneOf(errorCode, StratumErrorCode.all, 'errorCode');
        precon.string(message, 'message');

        const _ = this;
        _._code = errorCode;
        _._message = message;
    }


    /**
     * Incorrect nonce byte length.
     * @returns {StratumError}
     */
    static get INCORRECT_NONCE_SIZE() { return INCORRECT_NONCE_SIZE }

    /**
     * Job share belongs to is not valid or found.
     * @returns {StratumError}
     */
    static get STALE_SHARE() { return STALE_SHARE }

    /**
     * Share already submitted.
     * @returns {StratumError}
     */
    static get DUPLICATE_SHARE() { return DUPLICATE_SHARE }

    /**
     * Difficulty of share is below stratum difficulty.
     * @returns {StratumError}
     */
    static get LOW_DIFFICULTY() { return LOW_DIFFICULTY }

    /**
     * Worker is not recognized or authorized.
     * @returns {StratumError}
     */
    static get UNAUTHORIZED_WORKER() { return UNAUTHORIZED_WORKER }

    /**
     * Client has not subscribed yet.
     * @returns {StratumError}
     */
    static get NOT_SUBSCRIBED() { return NOT_SUBSCRIBED }

    /**
     * ProgPow share verification failed.
     * @returns {StratumError}
     */
    static get PROGPOW_VERIFY_FAILED() { return PROGPOW_VERIFY_FAILED }

    /**
     * ProgPow header hash size is incorrect.
     * @returns {StratumError}
     */
    static get PROGPOW_INCORRECT_HEADER_HASH_SIZE() { return PROGPOW_INCORRECT_HEADER_HASH_SIZE }

    /**
     * ProgPow mix hash size is incorrect.
     * @returns {StratumError}
     */
    static get PROGPOW_INCORRECT_MIX_HASH_SIZE() { return PROGPOW_INCORRECT_MIX_HASH_SIZE }

    /**
     * ProgPow header hash does not match calculated hash.
     * @returns {StratumError}
     */
    static get PROGPOW_HEADER_HASH_MISMATCH() { return PROGPOW_HEADER_HASH_MISMATCH }


    /**
     * Create a custom error.
     *
     * @param message {string} The error message.
     * @returns {StratumError}
     */
    static custom(message) {
        return new StratumError(StratumErrorCode.OTHER, message);
    }


    /**
     * The stratum error code.
     * @returns {number} (StratumErrorCode)
     */
    get code() { return this._code; }

    /**
     * The stratum error message.
     * @returns {string}
     */
    get message() { return this._message; }

    /**
     * The array used in stratum error response.
     * @returns {[number,string,null]}
     */
    get responseArr() { return [this._code, this._message, null]; }


    toJSON() {
        const _ = this;
        return {
            code: _.code,
            error: _.message
        };
    }
}

const INCORRECT_NONCE_SIZE = new StratumError(StratumErrorCode.OTHER, 'Incorrect size of nonce');
const STALE_SHARE = new StratumError(StratumErrorCode.STALE, 'Stale share - Job not found');
const DUPLICATE_SHARE = new StratumError(StratumErrorCode.DUPLICATE, 'Duplicate share');
const LOW_DIFFICULTY = new StratumError(StratumErrorCode.LOW_DIFFICULTY, 'Low difficulty');
const UNAUTHORIZED_WORKER = new StratumError(StratumErrorCode.UNAUTHORIZED_WORKER, 'Unauthorized worker');
const NOT_SUBSCRIBED = new StratumError(StratumErrorCode.NOT_SUBSCRIBED, 'Not subscribed');
const PROGPOW_VERIFY_FAILED = new StratumError(StratumErrorCode.OTHER, 'ProgPOW verify failed');
const PROGPOW_INCORRECT_HEADER_HASH_SIZE = new StratumError(StratumErrorCode.OTHER, 'ProgPOW incorrect header hash size');
const PROGPOW_INCORRECT_MIX_HASH_SIZE = new StratumError(StratumErrorCode.OTHER, 'ProgPOW incorrect mix hash size');
const PROGPOW_HEADER_HASH_MISMATCH = new StratumError(StratumErrorCode.OTHER, 'ProgPOW header hash mismatch');

module.exports = StratumError;