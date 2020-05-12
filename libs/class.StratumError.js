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
     * Incorrect ExtraNonce2 byte length.
     * @returns {StratumError}
     */
    static get INCORRECT_EXTRANONCE2_SIZE() { return INCORRECT_EXTRANONCE2_SIZE }

    /**
     * Incorrect nTime byte length.
     * @returns {StratumError}
     */
    static get INCORRECT_TIME_SIZE() { return INCORRECT_TIME_SIZE }

    /**
     * nTime value out of acceptable range.
     * @returns {StratumError}
     */
    static get TIME_OUT_OF_RANGE() { return TIME_OUT_OF_RANGE }

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

const INCORRECT_EXTRANONCE2_SIZE = new StratumError(StratumErrorCode.OTHER, 'Incorrect size of extranonce2');
const INCORRECT_TIME_SIZE = new StratumError(StratumErrorCode.OTHER, 'Incorrect size of ntime');
const TIME_OUT_OF_RANGE = new StratumError(StratumErrorCode.OTHER, 'ntime out of range');
const INCORRECT_NONCE_SIZE = new StratumError(StratumErrorCode.OTHER, 'Incorrect size of nonce');
const STALE_SHARE = new StratumError(StratumErrorCode.STALE, 'Stale share - Job not found');
const DUPLICATE_SHARE = new StratumError(StratumErrorCode.DUPLICATE, 'Duplicate share');
const LOW_DIFFICULTY = new StratumError(StratumErrorCode.LOW_DIFFICULTY, 'Low difficulty');
const UNAUTHORIZED_WORKER = new StratumError(StratumErrorCode.UNAUTHORIZED_WORKER, 'Unauthorized worker');
const NOT_SUBSCRIBED = new StratumError(StratumErrorCode.NOT_SUBSCRIBED, 'Not subscribed');

module.exports = StratumError;