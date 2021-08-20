'use strict';

const ChainParams = {
    get MAIN() {
        return {
            isTestnet: false,
            nSubsidyHalvingFirst: 302438,
            COIN: 100000000
        }
    },
    get TESTNET() {
        return {
            isTestnet: true,
            nSubsidyHalvingFirst: 12000,
            COIN: 100000000
        }
    },
    get REGTEST() {
        return {
            isTestnet: true,
            nSubsidyHalvingFirst: 302438,
            COIN: 100000000
        }
    }
};

module.exports = ChainParams;