'use strict';

const mtp = require('@mintpond/hasher-mtp');

const MTP_L = 64;

module.exports = {
    MTP_VERSION: 0x1000,
    MTP_HASH_ROOT_SIZE: 16,
    MTP_BLOCK_SIZE: 8 * MTP_L * 2 * 128,
    diff1: 0x00000000ffff0000000000000000000000000000000000000000000000000000,
    multiplier: Math.pow(2, 16),
    verify: (headerBuf, nonceBuf, mtpHashRootBuf, mtpBlockBuf, mtpProofBuf, hashValueOutBuf) => {
        return mtp.verify(headerBuf, nonceBuf, mtpHashRootBuf, mtpBlockBuf, mtpProofBuf, hashValueOutBuf);
    }
};