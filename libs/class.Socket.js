'use strict';

const
    EventEmitter = require('events'),
    NetSocket = require('net').Socket,
    bos = require('@mintpond/mint-bos'),
    BosDeserializeBuffer = require('@mintpond/mint-bos').BosDeserializeBuffer,
    precon = require('@mintpond/mint-precon'),
    mu = require('@mintpond/mint-utils');


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

        _._bosErrorsArr = [];

        _._socket.setKeepAlive(true);
        _._socket.setNoDelay(true);
        _._socket.on('data', _._bosReader.bind(_));
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
     * @param serializedData {Buffer} The data to write.
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
     * @returns {{data:Buffer,message:object}} An object containing the data data written to the socket and the original message.
     */
    send(message) {
        precon.obj(message, 'message');

        const _ = this;
        const serializedBuf = bos.serialize(message);

        _.write(serializedBuf, message);

        return { data: serializedBuf, message: message };
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


    _bosReader(dataBuf) {

        const _ = this;

        if (!_._bosBuffer)
            _._bosBuffer = new BosDeserializeBuffer(300000);

        if (!_._bosBuffer.append(dataBuf)) {
            _.emit(Socket.EVENT_MALFORMED_MESSAGE, 'Failed to read data');
            return;
        }

        const messagesArr = [];

        const totalRead = _._bosBuffer.deserialize(messagesArr, _._bosErrorsArr);
        if (totalRead === undefined) {
            _._bosBuffer.clear();
            _.emit(Socket.EVENT_MALFORMED_MESSAGE, `BOS Failed to parse: ${_._bosErrorsArr.pop()}`);
            return;
        }

        if (totalRead) {

            for (let i = 0; i < totalRead; i++) {
                const message = messagesArr[i];
                if (!message || !mu.isObject(message)) {
                    _.emit(Socket.EVENT_MALFORMED_MESSAGE, 'Invalid message object');
                    return;
                }

                _.emit(Socket.EVENT_MESSAGE_IN, { message: message });
            }
        }
    }
}

module.exports = Socket;
