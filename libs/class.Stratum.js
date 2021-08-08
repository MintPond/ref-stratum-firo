'use strict';

const
    EventEmitter = require('events'),
    precon = require('@mintpond/mint-precon'),
    RpcClient = require('./class.RpcClient'),
    Server = require('./class.Server'),
    Client = require('./class.Client'),
    Share = require('./class.Share'),
    JobManager = require('./class.JobManager');


class Stratum extends EventEmitter {

    /**
     * Constructor.
     *
     * @param config
     */
    constructor(config) {

        super();

        const _ = this;
        _._config = config;

        _._isInit = false;
        _._server = null;
        _._jobManager = null;
        _._rpcClient = null;
    }


    /**
     * The name of event emitted when a client connects.
     * @returns {string}
     */
    static get EVENT_CLIENT_CONNECT() { return 'clientConnect'; }

    /**
     * The name of event emitted when a client successfully subscribes.
     * @returns {string}
     */
    static get EVENT_CLIENT_SUBSCRIBE() { return 'clientSubscribe'; }

    /**
     * The name of event emitted when a client successfully authorizes their worker.
     * @returns {string}
     */
    static get EVENT_CLIENT_AUTHORIZE() { return 'clientAuthorize'; }

    /**
     * The name of event emitted when a client times out due to inactivity.
     * @returns {string}
     */
    static get EVENT_CLIENT_TIMEOUT() { return 'clientTimeout'; }

    /**
     * The name of event emitted when a client has a socket error unrelated to disconnect.
     * @returns {string}
     */
    static get EVENT_CLIENT_SOCKET_ERROR() { return 'clientSocketError'; }

    /**
     * The name of event emitted when a share is submitted.
     * @returns {string}
     */
    static get EVENT_SHARE_SUBMITTED() { return 'shareSubmitted'; }

    /**
     * The name of event emitted when a client disconnects.
     * @returns {string}
     */
    static get EVENT_CLIENT_DISCONNECT() { return 'clientDisconnect'; }

    /**
     * The name of event emitted when a client sends a malformed message.
     * @returns {string}
     */
    static get EVENT_CLIENT_MALFORMED_MESSAGE() { return 'clientMalformedMessage' }

    /**
     * The name of event emitted when a client sends a message with an unknown stratum method.
     * @returns {string}
     */
    static get EVENT_CLIENT_UNKNOWN_STRATUM_METHOD() { return 'clientUnknownStratumMethod' }

    /**
     * The name of event emitted when a new block is detected.
     * @returns {string}
     */
    static get EVENT_NEW_BLOCK() { return 'newBlock'; }

    /**
     * The name of event emitted when a job is broadcast.
     * @returns {string}
     */
    static get EVENT_NEXT_JOB() { return 'nextJob'; }


    /**
     * Determine if the stratum is initialized and started.
     * @returns {boolean}
     */
    get isInitialized() { return this._isInit; };

    /**
     * Get the stratum server.
     * @returns {null|Server}
     */
    get server() { return this._server; };

    /**
     * Get the job manager.
     * @returns {null|JobManager}
     */
    get jobManager() { return this._jobManager; }

    /**
     * Get the coin node RPC client.
     * @returns {null|RpcClient}
     */
    get rpcClient() { return this._rpcClient; }

    /**
     * Get the stratum configuration.
     * @returns {{...}}
     */
    get config() { return this._config; }


    /**
     * Start the stratum.
     */
    init(callback) {
        precon.opt_funct(callback, 'callback');

        const _ = this;

        _._server = _._createServer();
        _._jobManager = _._createJobManager();
        _._rpcClient = _._createRpcClient();

        _._server.on(Server.EVENT_CLIENT_CONNECT, _._reEmit(Stratum.EVENT_CLIENT_CONNECT));
        _._server.on(Server.EVENT_CLIENT_DISCONNECT, _._reEmit(Stratum.EVENT_CLIENT_DISCONNECT));
        _._server.on(Server.EVENT_CLIENT_SUBSCRIBE, _._reEmit(Stratum.EVENT_CLIENT_SUBSCRIBE));
        _._server.on(Server.EVENT_CLIENT_AUTHORIZE, _._reEmit(Stratum.EVENT_CLIENT_AUTHORIZE));
        _._server.on(Server.EVENT_CLIENT_TIMEOUT, _._reEmit(Stratum.EVENT_CLIENT_TIMEOUT));
        _._server.on(Server.EVENT_CLIENT_SOCKET_ERROR, _._reEmit(Stratum.EVENT_CLIENT_SOCKET_ERROR));
        _._server.on(Server.EVENT_CLIENT_MALFORMED_MESSAGE, _._reEmit(Stratum.EVENT_CLIENT_MALFORMED_MESSAGE));
        _._server.on(Server.EVENT_CLIENT_UNKNOWN_STRATUM_METHOD, _._reEmit(Stratum.EVENT_CLIENT_UNKNOWN_STRATUM_METHOD));

        // load first job
        _._jobManager.init((err) => {

            if (err)
                throw new Error(`Failed to start stratum server. Failed to get first job: ${JSON.stringify(err)}`);

            _._server.start(() => {
                _._jobManager.on(JobManager.EVENT_NEXT_JOB, _._onNextJob.bind(_));
                callback && callback();
            });
        });

        _._isInit = true;
    }


    /**
     * Stop the stratum.
     *
     * @param [callback] {function} Function to call after the stratum is stopped.
     */
    destroy(callback) {
        precon.opt_funct(callback, 'callback');

        const _ = this;
        _._jobManager && _._jobManager.destroy();
        _._server && _._server.stop(() => {
            callback && callback();
        });
    }


    /**
     * Notify the stratum of a new block on the network.
     *
     * This is only needed if block polling is disabled.
     */
    blockNotify() {
        const _ = this;
        _.jobManager && _.jobManager.blockNotify();
    }


    /**
     * Determine if a worker can be authorized or should be rejected.
     *
     * @param client {Client}
     * @param callback {function(err:*,isAuthorized:boolean)}
     */
    canAuthorizeWorker(client, callback) {
        callback(null, true);
    }


    /**
     * Handle a share submitted by a client.
     *
     * @param client {Client} The client that submitted the share.
     * @param share  {Share}  The share data.
     */
    submitShare(client, share) {
        precon.instanceOf(client, Client, 'client');
        precon.instanceOf(share, Share, 'share');

        const _ = this;

        if (share.isValidBlock) {

            _._submitBlock(share, (err) => {

                if (err) {
                    _._emitShare(share);
                    return;
                }

                _.jobManager.updateJob(() => {
                    _._checkBlockAccepted(share, (err, result) => {

                        if (err || !result.isAccepted) {
                            share.isValidBlock = false
                        }
                        else {
                            share.blockTxId = result.block.txId;
                        }

                        _._emitShare(share);
                    });
                });
            });
        }
        else {
            _._emitShare(share);
        }
    }


    _createServer() {
        const _ = this;
        return new Server({ stratum: _ });
    }


    _createJobManager() {
        const _ = this;
        return new JobManager({ stratum: _ });
    }


    _createRpcClient() {
        const _ = this;
        const rpc = _._config.rpc;
        return new RpcClient({
            host: rpc.host,
            port: rpc.port,
            user: rpc.user,
            password: rpc.password
        });
    }


    _submitBlock(share, callback) {

        const _ = this;
        _._rpcClient.cmd({
            method: 'submitblock',
            params: [share.blockHex],
            callback: (err, result) => {
                if (err) {
                    console.error(`Error while submitting block to node: ${JSON.stringify(err)}`);
                }
                else if (result) {
                    console.error(`Node rejected a supposedly valid block: ${JSON.stringify(result)}`)
                }
                callback(err || result);
            }
        });
    }


    _checkBlockAccepted(share, callback) {

        const _ = this;
        _._rpcClient.cmd({
            method: 'getblock',
            params: [share.blockId],
            callback: (err, block) => {
                if (err) {
                    console.error(`Failed to verify block submission: ${JSON.stringify(err)}`);
                    callback(err, {
                        isAccepted: false
                    });
                }
                else {
                    callback(null, {
                        isAccepted: true,
                        block: block
                    });
                }
            }
        });
    }


    _emitShare(share) {
        const _ = this;

        _.emit(Stratum.EVENT_SHARE_SUBMITTED, {
            client: share.client,
            share: share
        });
    }


    _onNextJob(ev) {
        precon.notNull(ev.job, 'job');
        precon.boolean(ev.isNewBlock, 'isNewBlock');

        const _ = this;
        const job = ev.job;
        const isNewBlock = ev.isNewBlock;

        _.emit(Stratum.EVENT_NEXT_JOB, { job: job, isNewBlock: isNewBlock });

        if (isNewBlock)
            _.emit(Stratum.EVENT_NEW_BLOCK, { job: job })

        _._server.sendMiningJob({
            job: job,
            isNewBlock: isNewBlock
        });
    }


    _reEmit(eventName, handlerFn) {
        const _ = this;
        return function(ev) {
            handlerFn && handlerFn(ev);
            _.emit(eventName, ev);
        };
    }
}

module.exports = Stratum;

