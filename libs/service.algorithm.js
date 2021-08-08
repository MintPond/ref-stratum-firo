'use strict';

const progpow = require('@mintpond/hasher-firopow');

module.exports = {
    diff1: 0x00000000ffff0000000000000000000000000000000000000000000000000000,
    multiplier: Math.pow(2, 8),
    epochLen: 1300,
    verify: (headerHashBuf, nonceBuf, blockHeight, mixHashBuf, hashOutBuf) => {
        return progpow.verify(headerHashBuf, nonceBuf, blockHeight, mixHashBuf, hashOutBuf);
    }
};