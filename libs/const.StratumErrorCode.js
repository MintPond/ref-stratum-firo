'use strict';

const StratumErrorCode = {
    get OTHER() { return 20 },
    get STALE() { return 21 },
    get DUPLICATE() { return 22 },
    get LOW_DIFFICULTY() { return 23 },
    get UNAUTHORIZED_WORKER() { return 24 },
    get NOT_SUBSCRIBED() { return 25 }
};

module.exports = StratumErrorCode;

Object.defineProperties(StratumErrorCode, {
    all: {
        value: [
            StratumErrorCode.OTHER,
            StratumErrorCode.STALE,
            StratumErrorCode.DUPLICATE,
            StratumErrorCode.LOW_DIFFICULTY,
            StratumErrorCode.UNAUTHORIZED_WORKER,
            StratumErrorCode.NOT_SUBSCRIBED
        ],
        enumerable: false
    }
});