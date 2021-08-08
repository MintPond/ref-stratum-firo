'use strict';

const
    EventEmitter = require('events'),
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils'),
    ClientWriter = require('./class.ClientWriter'),
    ClientReader = require('./class.ClientReader'),
    TcpSocket = require('@mintpond/mint-socket').TcpSocket,
    Job = require('./class.Job');

const TIMEOUT = 600;


class Client extends EventEmitter {

    /**
     * Constructor.
     *
     * @param args
     * @param args.subscriptionIdHex {string}
     * @param args.extraNonce1Hex {string}
     * @param args.stratum {Stratum}
     * @param args.socket {TcpSocket}
     * @param args.port {{number:number, diff:number}}
     */
    constructor(args) {
        precon.string(args.subscriptionIdHex, 'subscriptionIdHex');
        precon.string(args.extraNonce1Hex, 'extraNonce1Hex');
        precon.notNull(args.stratum, 'stratum');
        precon.instanceOf(args.socket, TcpSocket, 'socket');
        precon.notNull(args.port, 'port');

        super();

        const _ = this;
        _._subscriptionIdHex = args.subscriptionIdHex;
        _._extraNonce1Hex = args.extraNonce1Hex;
        _._stratum = args.stratum;
        _._socket = args.socket;
        _._port = args.port;

        _._writer = new ClientWriter({ client: _ });
        _._reader = new ClientReader({
            stratum: _._stratum,
            client: _,
            writer: _._writer
        });

        _._ipAddress = _._socket.remoteAddress;
        _._prevJob = null;
        _._currentJob = null;
        _._nextJob = null;
        _._minerAddress = null;
        _._workerName = null;
        _._isSubscribed = false;
        _._isAuthorized = false;
        _._disconnectReason = '';

        _._socket.on(TcpSocket.EVENT_MESSAGE_IN, _._onSocketMessageIn.bind(_));
        _._socket.on(TcpSocket.EVENT_MALFORMED_MESSAGE, _._onMalformedMessage.bind(_));
        _._socket.on(TcpSocket.EVENT_DISCONNECT, _._onDisconnect.bind(_));
        _._socket.on(TcpSocket.EVENT_ERROR, _._onSocketError.bind(_));
    }


    /**
     * The name of event emitted when a client successfully subscribes.
     * @returns {string}
     */
    static get EVENT_SUBSCRIBE() { return 'subscribe'; }

    /**
     * The name of event emitted when the client successfully authorizes a worker.
     * @returns {string}
     */
    static get EVENT_AUTHORIZE() { return 'authorize' }

    /**
     * The name of event emitted when the client socket is disconnected.
     * @returns {string}
     */
    static get EVENT_DISCONNECT() { return 'socketDisconnect' };

    /**
     * The name of event emitted when the client socket times out.
     * @returns {string}
     */
    static get EVENT_TIMEOUT() { return 'socketTimeout' };

    /**
     * The name of event emitted when the client socket has an error.
     * @returns {string}
     */
    static get EVENT_SOCKET_ERROR() { return 'socketError' };

    /**
     * The name of event emitted when the client submits a malformed message.
     * @returns {string}
     */
    static get EVENT_MALFORMED_MESSAGE() { return 'malformedMessage' };

    /**
     * Gets name of event emitted when the client submits a message with an unrecognized stratum method.
     * @returns {string}
     */
    static get EVENT_UNKNOWN_STRATUM_METHOD() { return 'unknownStratumMethod' };


    /**
     * Get the subscription ID hex.
     * @returns {string}
     */
    get subscriptionIdHex() { return this._subscriptionIdHex; }

    /**
     * Get the clients assigned extraNonce1 hex.
     * @returns {string}
     */
    get extraNonce1Hex() { return this._extraNonce1Hex; }

    /**
     * Get the client socket.
     * @returns {TcpSocket}
     */
    get socket() { return this._socket; }

    /**
     * Get the clients previous stratum job for the same block as the current job.
     * @returns {null|Job}
     */
    get prevJob() { return this._prevJob; }

    /**
     * Get the clients latest stratum job.
     * @returns {null|Job}
     */
    get currentJob() { return this._currentJob; }

    /**
     * Get the clients IP address.
     * @returns {string}
     */
    get ipAddress() { return this._ipAddress; }

    /**
     * Get the stratum port the client is connected to.
     * @returns {{number:number, diff:number}}
     */
    get port() { return this._port; }

    /**
     * Determine if the client has successfully subscribed via "mining.subscribe"
     * @returns {boolean}
     */
    get isSubscribed() { return this._isSubscribed; }
    set isSubscribed(is) {
        precon.boolean(is, 'isSubscribed');

        if (is !== true)
            throw new Error('isSubscribed can only be set to true.');

        if (this._isSubscribed)
            throw new Error('isSubscribed can only be set once.');

        this._isSubscribed = true;

        this.emit(Client.EVENT_SUBSCRIBE);
    }

    /**
     * Determine if the client has successfully authorized a worker via "mining.authorize"
     * @returns {boolean}
     */
    get isAuthorized() { return this._isAuthorized; }
    set isAuthorized(is) {
        precon.boolean(is, 'isAuthorized');

        const _ = this;

        if (is !== true)
            throw new Error('isAuthorized can only be set to true.');

        if (_._isAuthorized)
            throw new Error('isAuthorized can only be set once.');

        _._isAuthorized = true;

        _.emit(Client.EVENT_AUTHORIZE);
    }

    /**
     * Get the epoch time in seconds of the last major action received from the client.
     * @returns {number}
     */
    get lastActivity() { return this._lastActivity; }
    set lastActivity(time) {
        precon.positiveInteger(time, 'time');

        if (time < this._lastActivity)
            throw new Error('lastActivity must be set to a higher value than previous.');

        this._lastActivity = time;
    }

    /**
     * Get the miner wallet address of the authorized worker.
     * @returns {string}
     */
    get minerAddress() { return this._minerAddress; }

    /**
     * Get the full worker name of the authorized worker.
     * @returns {string}
     */
    get workerName() { return this._workerName; }
    set workerName(workerName) {
        precon.string(workerName, 'workerName');

        const _ = this;
        if (_._workerName)
            throw new Error('workerName can only be set once.');

        _._workerName = workerName;
        _._minerAddress = workerName.split('.')[0];
    }

    /**
     * Get the clients current stratum difficulty (pool scale).
     * @returns {number}
     */
    get diff() { return this._port.diff; }

    /**
     * Get the disconnect reason after the client disconnects, if any recorded.
     * @returns {string}
     */
    get disconnectReason() { return this._disconnectReason; }


    /**
     * Set the clients mining job. If the job is for a new block it will be sent immediately. If not it will be added
     * to the #nextJob property and must be sent using #sendNextJob() via external calls.
     *
     * @param args
     * @param args.job        {Job}
     * @param args.isNewBlock {boolean}
     */
    setJob(args) {
        precon.instanceOf(args.job, Job, 'job');
        precon.boolean(args.isNewBlock, 'isNewBlock');

        const _ = this;
        const job = args.job;
        const isNewBlock = args.isNewBlock;

        if (!_.isSubscribed)
            throw new Error(`Cannot send mining job to unsubscribed client.`);

        if (!_.isAuthorized)
            throw new Error(`Cannot send mining job to unauthorized client.`);

        if (_._isTimedOut())
            return;

        _._prevJob = isNewBlock ? null : _._currentJob;
        _._currentJob = job;

        _._writer.miningNotify({
            job: job,
            diff: _.diff,
            cleanJobs: isNewBlock
        });
    }


    /**
     * Disconnect the client.
     */
    disconnect(reason) {
        precon.opt_string(reason, 'reason');
        const _ = this;

        _._disconnectReason = reason || '';
        _._socket.destroy();
    }


    toJSON() {
        const _ = this;
        return {
            subscriptionId: _.subscriptionIdHex,
            ipAddress: _.ipAddress,
            port: _.port.number,
            worker: _.isAuthorized ? _.workerName : undefined
        }
    }


    _isTimedOut() {
        const _ = this;
        const elapsedTime = mu.now() - _.lastActivity;
        const isTimedOut = elapsedTime > TIMEOUT;

        if (isTimedOut) {
            _.emit(Client.EVENT_TIMEOUT, elapsedTime);
            _.disconnect('Timed out');
        }

        return isTimedOut;
    }


    _onSocketMessageIn(ev) {
        const _ = this;
        const message = ev.message;

        if (!_._reader.handleMessage(message)) {
            _.emit(Client.EVENT_UNKNOWN_STRATUM_METHOD, { message: message });
        }
    }


    _onMalformedMessage(ev) {
        const _ = this;
        _.emit(Client.EVENT_MALFORMED_MESSAGE, ev);
        _.disconnect('Malformed message');
    }


    _onDisconnect() {
        const _ = this;
        _.emit(Client.EVENT_DISCONNECT, { client: _, reason: _._disconnectReason });
    }


    _onSocketError(err) {
        const _ = this;
        if (err.code !== 'ECONNRESET') {
            _.emit(Client.EVENT_SOCKET_ERROR, err);
        }
    }
}

module.exports = Client;