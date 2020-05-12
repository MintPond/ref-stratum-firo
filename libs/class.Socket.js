'use strict';

const
    EventEmitter = require('events'),
    NetSocket = require('net').Socket,
    precon = require('@mintpond/mint-precon');


/**
 * A wrapper for the socket connection of a client.
 */
class Socket extends EventEmitter {

    /**
     * Constructor.
     *
     * @param netSocket {net.Socket} The TCP socket to wrap.
     */
    constructor(netSocket) {
        precon.instanceOf(netSocket, NetSocket, 'netSocket');

        super();

        const _ = this;
        _._socket = netSocket;

        _._jsonBuffer = '';
        _._remoteAddress = _._socket.remoteAddress;
        _._localAddress = _._socket.localAddress;
        _._localPort = _._socket.localPort;

        _._socket.setEncoding('utf8');
        _._socket.setKeepAlive(true);
        _._socket.setNoDelay(true);
        _._socket.on('data', _._jsonReader.bind(_));
        _._socket.on('close', _._onSocketClose.bind(_));
        _._socket.on('error', _._onSocketError.bind(_));
    }


    /**
     * Name of event emitted when a malformed message is received.
     * @returns {string}
     */
    static get EVENT_MALFORMED_MESSAGE() { return 'malformedMessage' };

    /**
     * Name of event emitted when a valid message is received.
     * @returns {string}
     */
    static get EVENT_MESSAGE_IN() { return 'messageIn' };

    /**
     * Name of event emitted when a valid message is received.
     * @returns {string}
     */
    static get EVENT_MESSAGE_OUT() { return 'messageOut' };

    /**
     * Name of event emitted when the socket is disconnected.
     * @returns {string}
     */
    static get EVENT_DISCONNECT() { return 'disconnect' };

    /**
     * Name of event emitted when a socket error occurs.
     * @returns {string}
     */
    static get EVENT_ERROR() { return 'socketError' };


    /**
     * Get the remote address of the connected client.
     * @returns {string}
     */
    get remoteAddress() { return this._remoteAddress; }

    /**
     * Get the local address the client is connected to.
     * @returns {string}
     */
    get localAddress() { return this._localAddress; }

    /**
     * Get the local port the client is connected to.
     * @returns {number}
     */
    get localPort() { return this._localPort; }


    /**
     * Write raw data to the socket.
     *
     * @param serializedData {string|Buffer} The data to write.
     * @param originalMessage {object} The unserialized message so it can be included in event arguments.
     */
    write(serializedData, originalMessage) {
        const _ = this;

        _.emit(Socket.EVENT_MESSAGE_OUT, { message: originalMessage, data: serializedData });

        _._socket.write(serializedData);
    }


    /**
     * Serialize and write a stratum message to the socket.
     *
     * @param message {object} The object to write.
     * @returns {{data:string|Buffer,message:object}} An object containing the data data written to the socket and the original message.
     */
    send(message) {
        precon.obj(message, 'message');

        const _ = this;

        const jsonString = JSON.stringify(message) + '\n';
        _.write(jsonString, message);
        return { data: jsonString, message: message };
    }


    /**
     * Destroy the socket.
     */
    destroy() {
        const _ = this;
        _._socket.destroy();
    }


    _onSocketClose() {
        const _ = this;
        _.emit(Socket.EVENT_DISCONNECT);
    }


    _onSocketError(err) {
        const _ = this;
        if (err.code !== 'ECONNRESET')
            _.emit(Socket.EVENT_ERROR, { error: err });
    }


    _jsonReader(dataBuffer) {

        const _ = this;

        const dataBufferString = dataBuffer.toString();
        _._jsonBuffer += dataBufferString;

        if (dataBufferString.lastIndexOf('\n') !== -1) {

            const messages = _._jsonBuffer.split('\n');
            const incomplete = _._jsonBuffer.slice(-1) === '\n'
                ? ''
                : messages.pop();

            messages.forEach(strMessage => {

                if (!strMessage)
                    return;

                const message = Socket._parseJson(strMessage);
                if (!message) {
                    _.emit(Socket.EVENT_MALFORMED_MESSAGE, strMessage);
                    return;
                }

                _.emit(Socket.EVENT_MESSAGE_IN, { message: message });
            });
            _._jsonBuffer = incomplete;
        }
    }


    static _parseJson(json) {
        try {
            return JSON.parse(json);
        }
        catch (e) {
            return false;
        }
    }
}

module.exports = Socket;
