'use strict';

const ChainParams = {
    get MAIN() {
        return {
            isTestnet: false,
            nSubsidyHalvingFirst: 302438,
            COIN: 100000000,
            stage3StartTime: 1655380800, // Thursday, 16 June 2022 12:00:00 UTC
            stage3DevelopmentFund: 0.9375,
            stage3CommunityFund: 0.625,
            stage3DevelopmentFundAddress: 'aLgRaYSFk6iVw2FqY1oei8Tdn2aTsGPVmP',
            stage3CommunityFundAddress: 'aFA2TbqG9cnhhzX5Yny2pBJRK5EaEqLCH7'
        }
    },
    get TESTNET() {
        return {
            isTestnet: true,
            nSubsidyHalvingFirst: 12000,
            COIN: 100000000,
            stage3StartTime: 1653409800, // May 24th 2022 04:30 UTC
            stage3DevelopmentFund: 0.9375,
            stage3CommunityFund: 0.625,
            stage3DevelopmentFundAddress: 'TWDxLLKsFp6qcV1LL4U2uNmW4HwMcapmMU',
            stage3CommunityFundAddress: 'TCkC4uoErEyCB4MK3d6ouyJELoXnuyqe9L'
        }
    },
    get REGTEST() {
        return {
            isTestnet: true,
            nSubsidyHalvingFirst: 302438,
            COIN: 100000000,
            stage3StartTime: 2147483647,
            stage3DevelopmentFund: 0.9375,
            stage3CommunityFund: 0.625,
            stage3DevelopmentFundAddress: 'TGEGf26GwyUBE2P2o2beBAfE9Y438dCp5t',
            stage3CommunityFundAddress: 'TJmPzeJF4DECrBwUftc265U7rTPxKmpa4F'
        }
    }
};

module.exports = ChainParams;