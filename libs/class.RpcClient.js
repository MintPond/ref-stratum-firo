'use strict';

const
    http = require('http'),
    precon = require('@mintpond/mint-precon');


class RpcClient {

    /**
     * Constructor.
     *
     * @param args
     * @param args.host {string}
     * @param args.port {number}
     * @param [args.user] {string}
     * @param [args.password] {string}
     */
    constructor(args) {
        precon.string(args.host, 'host');
        precon.minMaxInteger(args.port, 1, 65535, 'port');
        precon.opt_string(args.user, 'user');
        precon.opt_string(args.password, 'password');

        const _ = this;
        _._host = args.host;
        _._port = args.port;
        _._user = args.user || '';
        _._password = args.password || '';

        _._msgId = 0;
    }


    /**
     * Send an RPC method to the wallet daemon.
     *
     * @param args
     * @param args.method     {string}   The RPC method name.
     * @param [args.params]   {Array}    Array containing method parameter arguments.
     * @param [args.callback(err, rpcResult)] {function} Function to callback when RPC response is received.
     */
    cmd(args) {
        precon.string(args.method, 'method');
        precon.opt_array(args.params, 'params');

        const _ = this;
        const method = args.method;
        const params = args.params || [];
        const request = {
            method: method,
            params: params,
            id: _._msgId++
        };

        _._sendRequest(request, args.callback);
    }


    /**
     * Validate a wallet address.
     *
     * @param args
     * @param args.address {string}
     * @param [args.callback] {function(err:*, )}
     */
    validateAddress(args) {
        precon.string(args.address, 'address');
        precon.opt_funct(args.callback, 'callback');

        const _ = this;
        const address = args.address;
        const callback = args.callback;

        _.cmd({
            method: 'validateaddress',
            params: [address],
            callback: (err, results) => {
                if (err)
                    console.error(err);

                callback && callback(!err && results.isvalid, results);
            }
        });
    }


    _sendRequest(request, callback) {

        const _ = this;
        const serialized = JSON.stringify(request);
        const options = {
            hostname: _._host,
            port: _._port,
            method: 'POST',
            auth: `${_._user}:${_._password}`,
            headers: {
                'Content-Length': serialized.length
            }
        };

        const req = http.request(options, res => {

            let data = '';
            res.setEncoding('utf8');

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                callback && _._parseResponse({
                    res: res,
                    json: data,
                    callback: callback
                });
                callback = null;
            });
        });

        req.on('error', err => {
            callback && callback(err, null);
            callback = null;
        });

        req.end(serialized);
    }


    _parseResponse(args) {

        const _ = this;
        const res = args.res;
        const json = args.json;
        const callback = args.callback;

        if (res.statusCode === 401) {
            console.error('Daemon rejected username and/or password.');
            return;
        }

        const parsedJson = _._tryParseJson(json);

        if (parsedJson.error) {
            callback(parsedJson.error, null);
        }
        else {
            callback(parsedJson.parsed.error, parsedJson.parsed.result);
        }
    }


    _tryParseJson(json) {

        const _ = this;
        let result;

        try {
            result = {
                error: null,
                parsed: JSON.parse(json)
            }
        }
        catch (err) {

            if (json.indexOf(':-nan') !== -1) {
                json = json.replace(/:-nan,/g, ':0');
                result = _._tryParseJson(json);
            }
            else {
                result = {
                    error: err,
                    parsed: null
                };
            }
        }

        return result;
    }
}


module.exports = RpcClient;