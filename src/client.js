import Frame from './frame';
import {VERSIONS, BYTES, typedArrayToUnicodeString, unicodeStringToTypedArray} from './utils';

// STOMP Client Class
//
// All STOMP protocol is exposed as methods of this class (`connect()`,
// `send()`, etc.)
class Client {

    constructor(ws, options={binary:false, heartbeat: {outgoing:10000, incoming:10000}, debug:true}) {
        this.ws = ws;
        this.ws.binaryType = 'arraybuffer';
        this.binary = options.binary;
        this.hasDebug = options.debug;
        // used to index subscribers
        this.counter = 0;
        this.connected = false;
        // Heartbeat properties of the client
        // outgoing: send heartbeat every 10s by default (value is in ms)
        // incoming: expect to receive server heartbeat at least every 10s by default
        // falsy value means no heartbeat hence 0,0
        this.heartbeat = options.heartbeat || {outgoing: 0, incoming: 0};
        // maximum *WebSocket* frame size sent by the client. If the STOMP frame
        // is bigger than this value, the STOMP frame will be sent using multiple
        // WebSocket frames (default is 16KiB)
        this.maxWebSocketFrameSize = 16 * 1024;
        // subscription callbacks indexed by subscriber's ID
        this.subscriptions = {};
        this.partialData = '';
    }

    // //// Debugging
    //
    // By default, debug messages are logged in the window's console if it is defined.
    // This method is called for every actual transmission of the STOMP frames over the
    // WebSocket.
    //
    // It is possible to set a `debug(message)` method
    // on a client instance to handle differently the debug messages:
    //
    //     client.debug = function(str) {
    //         // append the debug log to a #debug div
    //         $("#debug").append(str + "\n");
    //     };
    debug(...args) {
        if (this.hasDebug) console.log(...args);
    }

    on(event) {
        if (event && Reflect.get(event)) {
            let p = new Promise((resolve, reject) => {
                resolve();
                reject();
            });
            return p;
        } else {
            throw new Error();
        }
    }

    // [CONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECT_or_STOMP_Frame)
    //
    // The `connect` method accepts different number of arguments and types:
    //
    // * `connect(headers, connectCallback)`
    // * `connect(headers, connectCallback, errorCallback)`
    // * `connect(login, passcode, connectCallback)`
    // * `connect(login, passcode, connectCallback, errorCallback)`
    // * `connect(login, passcode, connectCallback, errorCallback, host)`
    //
    // The errorCallback is optional and the 2 first forms allow to pass other
    // headers in addition to `client`, `passcode` and `host`.
    connect(...args) {
        let p = new Promise((resolve, reject) => {
            let headers = this._parseConnect(...args);
            this.debug('Opening Web Socket...');
            this.ws.onmessage = (evt) => {
                const unmarshalledData = Client._getData(evt);
                this.serverActivity = Date.now();
                unmarshalledData.frames.forEach(frame => {
                    switch (frame.command) {
                        // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
                        case 'CONNECTED':
                            this._connected(resolve, frame);
                            break;
                        // [MESSAGE Frame](http://stomp.github.com/stomp-specification-1.1.html#MESSAGE)
                        case 'MESSAGE':
                            this._message(frame);
                            break;
                        // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
                        case 'RECEIPT':
                            this.receipt(frame);
                            break;
                        // [ERROR Frame](http://stomp.github.com/stomp-specification-1.1.html#ERROR)
                        case 'ERROR':
                            this.error(frame);
                            break;
                        default:
                            this._unhandle(frame);
                    }
                });
            };
            this.ws.onclose = (ev) => {
                this._close(reject, ev);
            };
            this.ws.onopen = () => {
                this._open(headers);
            };
        });
        return p;
    }

    // [DISCONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#DISCONNECT)
    disconnect(headers = {}) {
        this._transmit('DISCONNECT', headers);
        // Discard the onclose callback to avoid calling the errorCallback when
        // the client is properly disconnected.
        this.ws.onclose = null;
        this.ws.close();
        this._cleanUp();
    }

    // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
    //
    // * `destination` is MANDATORY.
    send(destination, body='', headers={}) {
        headers.destination = destination;
        this._transmit('SEND', headers, body);
    }

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    //
    // If no transaction ID is passed, one will be created automatically
    begin(transaction=`tx-${this.counter++}`) {
        this._transmit('BEGIN', {transaction});
        return {
            id: transaction,
            commit: this.commit.bind(this, transaction),
            abort: this.abort.bind(this, transaction)
        };
    }

    // [COMMIT Frame](http://stomp.github.com/stomp-specification-1.1.html#COMMIT)
    //
    // * `transaction` is MANDATORY.
    //
    // It is preferable to commit a transaction by calling `commit()` directly on
    // the object returned by `client.begin()`:
    //
    //     var tx = client.begin(txid);
    //     ...
    //     tx.commit();
    commit(transaction) {
        this._transmit('COMMIT', {transaction});
    }

    // [ABORT Frame](http://stomp.github.com/stomp-specification-1.1.html#ABORT)
    //
    // * `transaction` is MANDATORY.
    //
    // It is preferable to abort a transaction by calling `abort()` directly on
    // the object returned by `client.begin()`:
    //
    //     var tx = client.begin(txid);
    //     ...
    //     tx.abort();
    abort(transaction) {
        this._transmit('ABORT', {transaction});
    }

    // [ACK Frame](http://stomp.github.com/stomp-specification-1.1.html#ACK)
    //
    // * `messageID` & `subscription` are MANDATORY.
    //
    // It is preferable to acknowledge a message by calling `ack()` directly
    // on the message handled by a subscription callback:
    //
    //     client.subscribe(destination,
    //       function(message) {
    //         // process the message
    //         // acknowledge it
    //         message.ack();
    //       },
    //       {'ack': 'client'}
    //     );
    ack(messageID, subscription, headers={}) {
        // 1.2 change id header name from message-id to id
        var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
        headers[idAttr] = messageID;
        headers.subscription = subscription;
        this._transmit('ACK', headers);
    }

    // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
    //
    // * `messageID` & `subscription` are MANDATORY.
    //
    // It is preferable to nack a message by calling `nack()` directly on the
    // message handled by a subscription callback:
    //
    //     client.subscribe(destination,
    //       function(message) {
    //         // process the message
    //         // an error occurs, nack it
    //         message.nack();
    //       },
    //       {'ack': 'client'}
    //     );
    nack(messageID, subscription, headers={}) {
        // 1.2 change id header name from message-id to id
        var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
        headers[idAttr] = messageID;
        headers.subscription = subscription;
        this._transmit('NACK', headers);
    }

    // [SUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#SUBSCRIBE)
    subscribe(destination, callback, headers={}) {
        // for convenience if the `id` header is not set, we create a new one for this client
        // that will be returned to be able to unsubscribe this subscription
        if (!headers.id) headers.id = 'sub-' + this.counter++;
        headers.destination = destination;
        this.subscriptions[headers.id] = callback;
        this._transmit('SUBSCRIBE', headers);
        return {
            id: headers.id,
            unsubscribe: this.unsubscribe.bind(this, headers.id)
        };
    }

    // [UNSUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#UNSUBSCRIBE)
    //
    // * `id` is MANDATORY.
    //
    // It is preferable to unsubscribe from a subscription by calling
    // `unsubscribe()` directly on the object returned by `client.subscribe()`:
    //
    //     var subscription = client.subscribe(destination, onmessage);
    //     ...
    //     subscription.unsubscribe(headers);
    unsubscribe(id, headers={}) {
        delete this.subscriptions[id];
        headers.id = id;
        this._transmit('UNSUBSCRIBE', headers);
    }

    // Clean up client resources when it is disconnected or the server did not
    // send heart beats in a timely fashion
    _cleanUp() {
        this.connected = false;
        clearInterval(this.pinger);
        clearInterval(this.ponger);
    }

    // Base method to transmit any stomp frame
    _transmit(command, headers, body) {
        let out = Frame.marshall(command, headers, body);
        this.debug(`>>> ${out}`);
        this._wsSend(out);
    }

    _wsSend(data) {
        if (this.binary) data = unicodeStringToTypedArray(data);
        this.debug(`>>> length ${data.length}`);
        // if necessary, split the *STOMP* frame to send it on many smaller
        // *WebSocket* frames
        while (true) {
            if (data.length > this.maxWebSocketFrameSize) {
                this.ws.send(data.slice(0, this.maxWebSocketFrameSize));
                data = data.slice(this.maxWebSocketFrameSize);
                this.debug(`remaining = ${data.length}`);
            } else {
                return this.ws.send(data);
            }
        }
    }

    // Heart-beat negotiation
    _setupHeartbeat(headers) {
        if (this.version !== VERSIONS.V1_1 && this.version !== VERSIONS.V1_2) return;

        // heart-beat header received from the server looks like:
        //
        //     heart-beat: sx, sy
        const [serverOutgoing, serverIncoming] = (headers['heart-beat'] || '0,0').split(',').map(v => parseInt(v, 10));

        if (!(this.heartbeat.outgoing === 0 || serverIncoming === 0)) {
            let ttl = Math.max(this.heartbeat.outgoing, serverIncoming);
            this.debug(`send PING every ${ttl}ms`);
            this.pinger = setInterval(() => {
                this._wsSend(BYTES.LF);
                this.debug('>>> PING');
            }, ttl);
        }

        if (!(this.heartbeat.incoming === 0 || serverOutgoing === 0)) {
            let ttl = Math.max(this.heartbeat.incoming, serverOutgoing);
            this.debug(`check PONG every ${ttl}ms`);
            this.ponger = setInterval(() => {
                let delta = Date.now() - this.serverActivity;
                // We wait twice the TTL to be flexible on window's setInterval calls
                if (delta > ttl * 2) {
                    this.debug(`did not receive server activity for the last ${delta}ms`);
                    this.ws.close();
                }
            }, ttl);
        }
    }

    _connected(connectCallback, frame) {
        this.debug(`connected to server ${frame.headers.server}`);
        this.connected = true;
        this.version = frame.headers.version;
        this._setupHeartbeat(frame.headers);
        if (connectCallback) {
            connectCallback(frame);
        }
    }

    _open(headers) {
        this.debug('Web Socket Opened...');
        headers['accept-version'] = VERSIONS.supportedVersions();
        // Check if we already have heart-beat in headers before adding them
        if (!headers['heart-beat']) {
            headers['heart-beat'] = [this.heartbeat.outgoing, this.heartbeat.incoming].join(',');
        }
        this._transmit('CONNECT', headers);
    }

    _close(errorCallback, ev) {
        this.debug(`Whoops! Lost connection to ${this.ws.url}:`, ev);
        this._cleanUp();
        if (errorCallback) {
            errorCallback(ev);
        }
    }

    _message(frame) {
        // the `onreceive` callback is registered when the client calls
        // `subscribe()`.
        // If there is registered subscription for the received message,
        // we used the default `onreceive` method that the client can set.
        // This is useful for subscriptions that are automatically created
        // on the browser side (e.g. [RabbitMQ's temporary
        // queues](http://www.rabbitmq.com/stomp.html)).
        const subscription = frame.headers.subscription;
        const onreceive = this.subscriptions[subscription] || this.receive;
        if (onreceive) {
            // 1.2 define ack header if ack is set to client
            // and this header must be used for ack/nack
            const messageID = this.version === VERSIONS.V1_2 &&
                frame.headers.ack ||
                frame.headers['message-id'];
            // add `ack()` and `nack()` methods directly to the returned frame
            // so that a simple call to `message.ack()` can acknowledge the message.
            frame.ack = this.ack.bind(this, messageID, subscription);
            frame.nack = this.nack.bind(this, messageID, subscription);
            onreceive(frame);
        } else {
            this.debug(`Unhandled received MESSAGE: ${frame}`);
        }
    }

    receive(frame) {
        this.debug(`Receive frame: ${frame}`);
    }

    receipt(frame) {
        // The client instance can set its `onreceipt` field to a function taking
        // a frame argument that will be called when a receipt is received from
        // the server:
        //
        //     client.onreceipt = function(frame) {
        //       receiptID = frame.headers['receipt-id'];
        //       ...
        //     }
        if (this.onreceipt) {
            this.onreceipt(frame);
        }
    }

    error(frame) {
        this.debug(`Error frame: ${frame}`);
    }

    _unhandle(frame) {
        this.debug(`Unhandled frame: ${frame}`);
    }

    _getData(evt) {
        let data = evt.data;
        if (evt.data instanceof ArrayBuffer) {
            data = typedArrayToUnicodeString(new Uint8Array(evt.data));
        }
        // heartbeat
        if (data === BYTES.LF) {
            this.debug('<<< PONG');
            return undefined;
        }
        this.debug(`<<< ${data}`);
        // Handle STOMP frames received from the server
        // The unmarshall function returns the frames parsed and any remaining
        // data from partial frames.
        data = Frame.unmarshall(this.partialData + data);
        this.partialData = data.partial;
        return data;
    }

    // parse the arguments number and type to find the headers, connectCallback and
    // (eventually undefined) errorCallback
    static _parseConnect(...args) {
        let headers = {};
        switch (args.length) {
            case 1:
                headers = args;
                break;
            case 2:
                [headers.login, headers.passcode] = args;
                break;
            case 3:
                [headers.login, headers.passcode, headers.host] = args;
                break;
            default:
                break;
        }
        return headers;
    }
}

export default Client;
