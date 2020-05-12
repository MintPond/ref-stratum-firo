'use strict';

const buffers = require('@mintpond/mint-utils').buffers;

module.exports = {
    diff1: 0x00000000ffff0000000000000000000000000000000000000000000000000000,
    multiplier: Math.pow(2, 8),
    hash: inputBuf => {
        return buffers.sha256d(inputBuf);
    }
};