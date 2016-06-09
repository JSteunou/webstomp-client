const http = require('http');
import sockjs from 'sockjs';
import Frame from './../../src/frame';
import {VERSIONS} from './../../src/utils';

class MockServer {

    constructor(ip, port, prefix) {
        this.ip = ip;
        this.port = port;
        this.prefix = prefix;
        this.subscribes = [];
        this.lastMessageId = 0;
        this.lastTransactionId = '';
    }

    start() {
        let srv = http.createServer((req, res) => {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('okay');
        });
        srv.on('upgrade', (req, socket, head) => {
            socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
                'Upgrade: WebSocket\r\n' +
                'Connection: Upgrade\r\n' +
                '\r\n');
            socket.pipe(socket);
        });

        this.sock = sockjs.createServer();
        this.sock.installHandlers(srv, {prefix: this.prefix});
        this.sock.on('connection', (conn) => {
            conn.on('data', (message) => {
                let frame = Frame.unmarshallSingle(message);
                if (frame) {
                    switch (frame.command) {
                        case 'CONNECT':
                            MockServer._onConnect(conn, frame);
                            break;

                        case 'DISCONNECT':
                            console.log('disconnected');
                            break;

                        case 'SEND':
                            MockServer._onSend(conn, frame);
                            break;

                        case 'SUBSCRIBE':
                            this._onSubscribe(conn, frame);
                            break;

                        case 'UNSUBSCRIBE':
                            this._onUnSubscribe(conn, frame);
                            break;

                        case 'ACK':
                            this._onAck(conn, frame);
                            break;

                        case 'NACK':
                            this._onNack(conn, frame);
                            break;

                        case 'BEGIN':
                            this._onBegin(conn, frame);
                            break;

                        case 'COMMIT':
                            this._onCommit(conn, frame);
                            break;

                        case 'ABORT':
                            this._onAbort(conn, frame);
                            break;

                        default:
                            break;
                    }
                }
            });
            conn.on('close', () => {
                console.log('closed');
            });
        });
        srv.listen(this.port, this.ip);
    }

    static _onConnect(conn, frame) {
        if (frame.headers.login === 'username' && frame.headers.passcode === 'password') {
            conn.write(Frame.marshall('CONNECTED', {version: VERSIONS.V1_2}, 'login success'));

        } else if (frame.headers['heartbeat-enable']) {
            conn.write(Frame.marshall('CONNECTED', {
                version: VERSIONS.V1_2,
                'heart-beat': '10, 10'
            }, ''));

        } else if (frame.headers['error-enable']) {
            conn.write(Frame.marshall('CONNECTED', {version: VERSIONS.V1_2}, ''));
            conn.write(Frame.marshall('ERROR', {}, ''));

        } else if (frame.headers['receipt-enable']) {
            conn.write(Frame.marshall('CONNECTED', {version: VERSIONS.V1_2}, ''));
            conn.write(Frame.marshall('RECEIPT', {}, ''));

        } else {
            conn.write(Frame.marshall('CONNECTED', {version: VERSIONS.V1_2}, ''));
        }
    }

    static _onSend(conn, frame) {
        if (frame.headers.destination === '/send') {
            if (frame.body === 'test' &&
                frame.headers.test &&
                frame.headers.test === 'test') {
                conn.write(Frame.marshall('MESSAGE', {}, '0'));
                return;
            }
        } else if (frame.headers.destination === '/largeFrame') {
            if (parseInt(frame.headers['content-length']) !== frame.body.length) {
                conn.write(Frame.marshall('MESSAGE', {}, frame.body));
                return;
            }
        }
        conn.write(Frame.marshall('MESSAGE', {}, '1'));
    }

    _onSubscribe(conn, frame) {
        if (frame.headers.destination === '/channel' && frame.headers.id) {
            this.subscribes.push(frame.headers.id);
            conn.write(Frame.marshall('MESSAGE', {subscription: frame.headers.id}, '0'));

        } else if ((frame.headers.destination === '/ack' || frame.headers.destination === '/nack') &&
            frame.headers.id) {
            this.subscribes.push(frame.headers.id);
            conn.write(Frame.marshall('MESSAGE', {
                subscription: frame.headers.id,
                'message-id': this.lastMessageId
            }, '1'));
        }
    }

    _onUnSubscribe(conn, frame) {
        if (frame.headers.id) {
            let index = this.subscribes.indexOf(frame.headers.id);
            if (index > -1) {
                this.subscribes.splice(index, 1);
                conn.write(Frame.marshall('MESSAGE', {id: frame.headers.id}, '0'));
                return;
            }
        }
        conn.write(Frame.marshall('MESSAGE', {id: frame.headers.id}, '1'));
    }

    _onAck(conn, frame) {
        let index = this.subscribes.indexOf(frame.headers.subscription);
        if (index > -1 && String(this.lastMessageId) === frame.headers.id) {
            this.lastMessageId++;
            conn.write(Frame.marshall('MESSAGE', {}, 'ack success'));
        } else {
            conn.write(Frame.marshall('MESSAGE', {}, 'ack failed'));
        }
    }

    _onNack(conn, frame) {
        let index = this.subscribes.indexOf(frame.headers.subscription);
        if (index > -1 && String(this.lastMessageId) === frame.headers.id) {
            this.lastMessageId++;
            conn.write(Frame.marshall('MESSAGE', {}, 'nack success'));
        } else {
            conn.write(Frame.marshall('MESSAGE', {}, 'nack failed'));
        }
    }

    _onBegin(conn, frame) {
        if (frame.headers.transaction) {
            this.lastTransactionId = frame.headers.transaction;
            conn.write(Frame.marshall('MESSAGE', {}, 'begin success'));
        } else {
            conn.write(Frame.marshall('MESSAGE', {}, 'begin failed'));
        }
    }

    _onCommit(conn, frame) {
        if (frame.headers.transaction && frame.headers.transaction === this.lastTransactionId) {
            conn.write(Frame.marshall('MESSAGE', {}, 'commit success'));
        } else {
            conn.write(Frame.marshall('MESSAGE', {}, 'commit failed'));
        }
        this.lastTransactionId = '';
    }

    _onAbort(conn, frame) {
        if (frame.headers.transaction && frame.headers.transaction === this.lastTransactionId) {
            conn.write(Frame.marshall('MESSAGE', {}, 'abort success'));
        } else {
            conn.write(Frame.marshall('MESSAGE', {}, 'abort failed'));
        }
        this.lastTransactionId = '';
    }
}

if (require.main === module) {
    let server = new MockServer('127.0.0.1', 1111, '/stomp');
    server.start();
}

export default MockServer;
