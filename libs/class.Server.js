'use strict';

const
    EventEmitter = require('events'),
    net = require('net'),
    precon = require('@mintpond/mint-precon'),
    JsonSocket = require('@mintpond/mint-socket').JsonSocket,
    Counter = require('@mintpond/mint-utils').Counter,
    Client = require('./class.Client');


class Server extends EventEmitter {

    /**
     * Constructor.
     *
     * @param args
     * @param args.stratum {Stratum}
     */
    constructor(args) {
        precon.notNull(args.stratum, 'stratum');

        super();

        const _ = this;
        _._stratum = args.stratum;

        _._config = _._stratum.config;
        _._extraNonceCounter = new Counter();
        _._isStarted = false;
        _._isStopped = false;
        _._server = null;
        _._clientMap = new Map();
    }


    /**
     * The name of event emitted when a client connects.
     * @returns {string}
     */
    static get EVENT_CLIENT_CONNECT() { return 'clientConnect' };

    /**
     * The name of event emitted when a client connects.
     * @returns {string}
     */
    static get EVENT_CLIENT_SUBSCRIBE() { return 'clientSubscribe' };

    /**
     * The name of event emitted when a client connects.
     * @returns {string}
     */
    static get EVENT_CLIENT_AUTHORIZE() { return 'clientAuthorize' };

    /**
     * The name of event emitted when a client is disconnected.
     * @returns {string}
     */
    static get EVENT_CLIENT_DISCONNECT() { return 'clientDisconnect' };

    /**
     * The name of event emitted when a client times out due to inactivity.
     * @returns {string}
     */
    static get EVENT_CLIENT_TIMEOUT() { return 'clientTimeout' };

    /**
     * The name of event emitted when a client has a socket error unrelated to disconnect
     * @returns {string}
     */
    static get EVENT_CLIENT_SOCKET_ERROR() { return 'clientSocketError' };

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
     * Start the server.
     *
     * @param [callback] {function} Called after the server is started.
     */
    start(callback) {
        precon.opt_funct(callback, 'callback');

        const _ = this;

        if (_._isStarted)
            throw new Error('Stratum server is already started.');

        _._isStarted = true;

        const host = _._config.host;
        const port = _._config.port;

        _._server = net.createServer({allowHalfOpen: false}, _._onClientConnect.bind(_, port));

        _._server.listen({
            host: host,
            port: port.number
        }, () => {
            console.log(`Stratum server listening on ${host}:${port.number}`);
            callback && callback();
        });
    }


    /**
     * Stop the server.
     *
     * @param [callback] {function} Called after the server is stopped.
     */
    stop(callback) {
        precon.opt_funct(callback, 'callback');

        const _ = this;

        if (_._isStopped) {
            callback && callback();
            return;
        }

        _._isStopped = true;

        _._server.close(() => {
            console.log(`Stratum server stopped.`);
            callback && callback();
        });

        for (const [subscriptionId, client] of _._clientMap) {
            client.disconnect();
            _._clientMap.delete(subscriptionId);
        }
    }


    /**
     * Broadcast job to all clients or to a specified array of Client's.
     *
     * @param args
     * @param args.job        {Job}     The job to broadcast.
     * @param args.isNewBlock {boolean} True if the job is for a new block or false to update current block.
     */
    sendMiningJob(args) {
        const _ = this;
        _.forEachClient(client => {
            if (client.isAuthorized)
                client.setJob(args);
        }, 100);
    }


    forEachClient(iteratorFn) {
        precon.funct(iteratorFn, 'iteratorFn');

        const _ = this;
        for (const client of _._clientMap.values()) {
            iteratorFn(client);
        }
    }


    _onClientConnect(port, netSocket) {

        const _ = this;

        if (_._isStopped || !netSocket.remoteAddress) {
            netSocket.destroy();
            return;
        }

        let extraNonce1Hex = _._extraNonceCounter.nextHex32();

        const socket = new JsonSocket({
            netSocket: netSocket
        });

        const client = new Client({
            subscriptionIdHex: extraNonce1Hex,
            extraNonce1Hex: extraNonce1Hex,
            stratum: _._stratum,
            socket: socket,
            port: port
        });

        client.on(Client.EVENT_SUBSCRIBE, _._reEmit(Server.EVENT_CLIENT_SUBSCRIBE, client));
        client.on(Client.EVENT_AUTHORIZE, _._reEmit(Server.EVENT_CLIENT_AUTHORIZE, client));
        client.on(Client.EVENT_DISCONNECT, _._reEmit(Server.EVENT_CLIENT_DISCONNECT, client, () => {
            _._clientMap.delete(client.subscriptionIdHex);
        }));
        client.on(Client.EVENT_TIMEOUT, _._reEmit(Server.EVENT_CLIENT_TIMEOUT, client));
        client.on(Client.EVENT_SOCKET_ERROR, _._reEmit(Server.EVENT_CLIENT_SOCKET_ERROR, client));
        client.on(Client.EVENT_MALFORMED_MESSAGE, _._reEmit(Server.EVENT_CLIENT_MALFORMED_MESSAGE, client));
        client.on(Client.EVENT_UNKNOWN_STRATUM_METHOD, _._reEmit(Server.EVENT_CLIENT_UNKNOWN_STRATUM_METHOD, client));

        _._clientMap.set(extraNonce1Hex, client);
        _.emit(Server.EVENT_CLIENT_CONNECT, { client: client });
    }


    _reEmit(eventName, client, handlerFn) {
        const _ = this;
        return function (ev) {
            handlerFn && handlerFn(client, ev);
            _.emit(eventName, { client: client, ...ev });
        }
    }
}

module.exports = Server;