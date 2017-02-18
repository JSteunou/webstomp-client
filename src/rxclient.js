import Frame from './frame';
import {VERSIONS, BYTES, typedArrayToUnicodeString, unicodeStringToTypedArray} from './utils';
import {Subject, Observable} from 'rxjs';
// STOMP Client Class
//
// All STOMP protocol, except subscribe and unsubscribe, is exposed as methods of this class (`connect()`,
// `send()`, etc.)
class RxClient {

    constructor(ws, options = {}) {
        // cannot have default options object + destructuring in the same time in method signature
        let {binary = false, heartbeat = {outgoing: 10000, incoming: 10000}, debug = true} = options;

        this.ws = ws;
        this.ws.binaryType = 'arraybuffer';
        this.isBinary = !!binary;
        this.hasDebug = !!debug;
        // used to index subscribers
        this.counter = 0;
        this.connected = false;
        // Heartbeat properties of the client
        // outgoing: send heartbeat every 10s by default (value is in ms)
        // incoming: expect to receive server heartbeat at least every 10s by default
        // falsy value means no heartbeat hence 0,0
        this.heartbeat = heartbeat || {outgoing: 0, incoming: 0};
        // maximum *WebSocket* frame size sent by the client. If the STOMP frame
        // is bigger than this value, the STOMP frame will be sent using multiple
        // WebSocket frames (default is 16KiB)
        this.maxWebSocketFrameSize = 16 * 1024;
        // subscription observables subscriber counts indexed by stomp subscription ids.
        this._subscriptions = {};
        this.partialData = '';

        this._messageSubject = new Subject();
        this._receiptsSubject = new Subject();
    }


    // Gets the recipt Observable to handle incoming reciepts
    get receipts() {
        return this._receiptsSubject;
    }


     // [SUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#SUBSCRIBE)
     // Destination is mandatory.
     // Each call to this method generates a new subscription id, unless one is provided in the headers.
     // There can be multiple subscribers to this observable, once all subscribers have unsubscribed the unsubscribe command is sent
     // To the server.
    getObservableSubscription(destination, headers = {}) {

        if (!headers.id) headers.id = 'sub-' + this.counter++;
        headers.destination = destination;

        return Observable.create((observer) => {
            if (!this._subscriptions.hasOwnProperty(headers.id)) {
                this._subscriptions[headers.id] =  {id: headers.id, count: 0};
                this._transmit('SUBSCRIBE', headers);
            }

            this._subscriptions[headers.id].count++;
            observer.next();

        }).switchMap(() => this._messageSubject).filter(frame => frame.headers.subscription === headers.id).finally(() => this._unsubscribe(headers.id));
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

    // [CONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECT_or_STOMP_Frame)
    //
    // The `connect` method accepts different number of arguments and types:
    //
    // * `connect(headers)`
    // * `connect(login, passcode)`
    // * `connect(login, passcode)`
    // * `connect(login, passcode, host)`
    //
    // first form allow to pass other
    // headers in addition to `client`, `passcode` and `host`.
    // The general error handler for error frames should be for the observer this observable.
    // It is recommended to only have one subscriber to this observable, subsequent subscriptions will cause the client to reconnect, which will cause the CONNECTED frame
    // to be resent to existing subscribers
    connect(...args) {
        console.log('COnnecting');
        let headers = this._parseConnect(...args);
        if (this._recieptSubscription === null) {
            this._recieptSubscription = this._receiptsSubject.subscribe((frame) => {
                this.latestReceipt = frame.headers['receipt-id'];
            });
        }


        return this._internalConnect(headers).finally(() => this.disconnect({receipt: this.latestReceipt}));
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
    send(destination, body = '', headers = {}) {
        headers.destination = destination;
        this._transmit('SEND', headers, body);
    }

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    //
    // If no transaction ID is passed, one will be created automatically
    begin(transaction = `tx-${this.counter++}`) {
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
    ack(messageID, subscription, headers = {}) {
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
    nack(messageID, subscription, headers = {}) {
        // 1.2 change id header name from message-id to id
        var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
        headers[idAttr] = messageID;
        headers.subscription = subscription;
        this._transmit('NACK', headers);
    }


    // [UNSUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#UNSUBSCRIBE)
    //
    // * `id` is MANDATORY.
    //
    // It is preferable to unsubscribe from a subscription by calling
    // `unsubscribe()` directly on the subscription returned by subscribing to `client.getObservableSubscription()`:
    //
    //     var subscription = client.getObservableSubscription(destination).subscribe(onMessage);
    //     ...
    //     subscription.unsubscribe();

    _unsubscribe(id, headers = {}) {
        headers.id = id;
        if (this._subscriptions[headers.id].count > 1) {
            this._subscriptions[headers.id].count--;
            return;
        }
        delete this._subscriptions[headers.id];
        this._transmit('UNSUBSCRIBE', headers);
    }


    // Clean up client resources when it is disconnected or the server did not
    // send heart beats in a timely fashion
    _cleanUp() {
        this.connected = false;
        this._recieptSubscription.unsubscribe();
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
        if (this.isBinary) data = unicodeStringToTypedArray(data);
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

    // parse the arguments number and type to find the headers
    _parseConnect(...args) {
        let headers = {};
        switch (args.length) {
            case 1:
                [headers] = args;
                break;
            case 2:
                [headers.login, headers.passcode] = args;
                break;
            case 3:
                [headers.login, headers.passcode, headers.host] = args;
                break;
            default:
                [headers.login, headers.passcode, headers.host] = args;
        }

        return headers;
    }

    _internalConnect(headers) {
        return Observable.create((observer) => {
            // Reconnect on new subscription
            if (this.connected) {
                this.disconnect({receipt: this.latestReceipt});
            }

            this.debug('Opening Web Socket...');
            this.ws.onmessage = (evt) => {
                let data = evt.data;
                if (evt.data instanceof ArrayBuffer) {
                    data = typedArrayToUnicodeString(new Uint8Array(evt.data));
                }
                this.serverActivity = Date.now();
                // heartbeat
                if (data === BYTES.LF) {
                    this.debug('<<< PONG');
                    return;
                }
                this.debug(`<<< ${data}`);

                // Handle STOMP frames received from the server
                // The unmarshall function returns the frames parsed and any remaining
                // data from partial frames.

                const unmarshalledData = Frame.unmarshall(this.partialData + data);
                this.partialData = unmarshalledData.partial;

                unmarshalledData.frames.forEach(frame => {
                    switch (frame.command) {
                        // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
                        case 'CONNECTED':
                            this.debug(`connected to server ${frame.headers.server}`);
                            this.connected = true;
                            this.version = frame.headers.version;
                            this._setupHeartbeat(frame.headers);
                            observer.next(frame);
                            break;
                        // [MESSAGE Frame](http://stomp.github.com/stomp-specification-1.1.html#MESSAGE)
                        case 'MESSAGE':

                            const subscription = frame.headers.subscription;
                                // 1.2 define ack header if ack is set to client
                                // and this header must be used for ack/nack
                            const messageID = this.version === VERSIONS.V1_2 &&
                                frame.headers.ack ||
                                frame.headers['message-id'];
                            // add `ack()` and `nack()` methods directly to the returned frame
                            // so that a simple call to `message.ack()` can acknowledge the message.
                            frame.ack = this.ack.bind(this, messageID, subscription);
                            frame.nack = this.nack.bind(this, messageID, subscription);

                            this._messageSubject.next(frame);

                            break;
                        // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
                        //
                        // The client instance can subscribe to the `receipts` field to a function taking
                        // a frame argument that will be called when a receipt is received from
                        // the server:
                        //
                        //     client.reciepts.subscribe(function(frame) {
                        //       receiptID = frame.headers['receipt-id'];
                        //       ...
                        //     });
                        case 'RECEIPT':
                            this._receiptsSubject.next(frame);
                            break;
                        // [ERROR Frame](http://stomp.github.com/stomp-specification-1.1.html#ERROR)
                        case 'ERROR':
                            observer.error(frame);
                            break;
                        default:
                            this.debug(`Unhandled frame: ${frame}`);
                    }
                });
            };
            this.ws.onclose = (ev) => {
                this.debug(`Whoops! Lost connection to ${this.ws.url}:`, ev);
                this._cleanUp();
                observer.error(ev);
            };
            this.ws.onopen = () => {
                this.debug('Web Socket Opened...');
                headers['accept-version'] = VERSIONS.supportedVersions();
                // Check if we already have heart-beat in headers before adding them
                if (!headers['heart-beat']) {
                    headers['heart-beat'] = [this.heartbeat.outgoing, this.heartbeat.incoming].join(',');
                }
                this._transmit('CONNECT', headers);
            };
        });
    }
}

export default RxClient;
