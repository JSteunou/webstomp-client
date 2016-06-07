import {assert} from "chai";
import webstomp from "./../src/webstomp";
import SockJS from "sockjs-client";

describe('[client]', function _client() {

    let url = 'http://127.0.0.1:1111/stomp';

    describe('[connect]', function _connect() {

        it('[connect fail]', function (done) {
            let sockjs = new SockJS(url + "/fail");
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };

            }, function _failed(evt) {
                //TODO Error callback should be make a distinction between error frame and close
                // event.
                if (evt && evt.hasOwnProperty("type") && evt["type"] === "close") {
                    assert.isFalse(client.connected);
                    done();

                } else {

                    throw {
                        name: "connectException",
                        message: "connected with error frame."
                    };
                }
            });
        });

        it('[connect success]', function (done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done(frame) {
                assert.isDefined(frame, 'command');
                assert.strictEqual(frame.command, "CONNECTED");
                assert.isTrue(client.connected);
                done();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });

        it('[disconnect]', function _disconnect(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done(frame) {
                assert.isTrue(client.connected);
                client.disconnect(function _disconnectTest() {
                    assert.isFalse(client.connected);
                    done();
                });
                done();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });

        it('[login]', function _login(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect("username", "password", function _done(frame) {
                assert.isDefined(frame, 'body');
                assert.strictEqual(frame.body, "login success");
                client.disconnect();
                done();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });
    });

    describe('[send]', function _send() {
        it('[send and message]', function _sendAndMsg(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                client.send('/send', 'test', {test: 'test'});

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
            client.onreceive = function _onreceive(frame) {
                assert.isDefined(frame, 'body');
                assert.strictEqual(frame.body, "0");
                done();
            };
        });
    });

    describe('[error]', function _error() {
        it('[error]', function _errorIt(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({"error-enable": "1"}, function _done() {

            }, function _failed(frame) {
                //TODO Error callback should be make a distinction between error frame and close
                // event.
                if (frame && frame.command === "ERROR") {
                    client.disconnect();
                    done();

                } else {
                    throw {
                        name: "connectException",
                        message: "connected failed."
                    };
                }
            });
        });
    });

    describe('[receipt]', function _receipt() {
        it('[receipt]', function _receipt(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({"receipt-enable": "1"}, function _done() {

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
            client.onreceipt = function _onreceipt(frame) {
                done();
            }
        });
    });

    describe('[subscribe]', function _subscribe() {

        let sockjs;
        let client;
        let sub;

        before((done)=> {
            sockjs = new SockJS(url);
            client = webstomp.over(sockjs);
            sub = {};
            client.connect({}, function _done() {
                done();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });

        it('[subscribe and message]', function _subscribe(done) {
            sub = client.subscribe("/channel", function _subCB(frame) {
                assert.isDefined(sub, 'id');
                assert.isDefined(client.subscriptions[sub.id]);
                assert.strictEqual(client.counter, 1);

                assert.isDefined(frame, 'body');
                assert.strictEqual(frame.body, "0");

                done();
            });
        });

        it('[subscribe and unsubscribe', function _unsubscribe(done) {
            assert.isDefined(sub, 'unsubscribe');
            sub.unsubscribe();
            client.onreceive = function _onreceive(frame) {
                assert.isDefined(frame.headers, 'id');
                assert.strictEqual(frame.headers.id, sub.id);
                done();
            };
        });
    });

    describe('[transaction]', function _transaction() {

        it('[ack]', function _ack(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                let sub = client.subscribe("/ack", function _subCB(frame) {
                    assert.isDefined(frame, 'ack');
                    frame.ack();
                });
                client.onreceive = function (frame) {
                    assert.strictEqual(frame.body, 'ack success');
                    sub.unsubscribe();
                    client.disconnect();
                    done();
                };

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });

        it('[nack]', function _nack(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                let sub = client.subscribe("/nack", function _subCB(frame) {
                    assert.isDefined(frame, 'nack');
                    frame.nack();
                });
                client.onreceive = function (frame) {
                    assert.strictEqual(frame.body, 'nack success');
                    sub.unsubscribe();
                    client.disconnect();
                    done();
                };

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });

        it('[begin and commit]', function _commit(done) {

            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                let tran;
                client.onreceive = function (frame) {
                    assert.strictEqual(frame.body, 'begin success');
                    assert.isDefined(tran, 'id');
                    assert.isDefined(tran, 'commit');
                    assert.isDefined(tran, 'abort');
                    tran.commit();

                    client.onreceive = function (frame) {
                        assert.strictEqual(frame.body, 'commit success');
                        client.disconnect();
                        done();
                    };
                };
                tran = client.begin();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });

        it('[begin and abort]', function _abort(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                let tran;
                client.onreceive = function (frame) {
                    assert.strictEqual(frame.body, 'begin success');

                    assert.isDefined(tran, 'id');
                    assert.isDefined(tran, 'commit');
                    assert.isDefined(tran, 'abort');
                    tran.abort();

                    client.onreceive = function (frame) {
                        assert.strictEqual(frame.body, 'abort success');
                        client.disconnect();
                        done();
                    };
                };
                tran = client.begin();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });

        });

        it('[begin commit and abort]', function _commitAndAbort(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, function _done() {
                let tran;
                client.onreceive = function (frame) {
                    assert.strictEqual(frame.body, 'begin success');
                    assert.isDefined(tran, 'id');
                    assert.isDefined(tran, 'commit');
                    assert.isDefined(tran, 'abort');
                    tran.commit();

                    client.onreceive = function (frame) {
                        assert.strictEqual(frame.body, 'commit success');
                        tran.abort();

                        client.onreceive = function (frame) {
                            assert.strictEqual(frame.body, 'abort failed');
                            client.disconnect();
                            done();
                        };
                    };
                };
                tran = client.begin();

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected failed."
                };
            });
        });
    });

    describe('[heartbeat]', function _heartbeat() {

        it('[heartbeat disconnect]', function _heartbeatDisconnect(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs, {heartbeat: {outgoing: 10, incoming: 10}});
            client.connect({"heartbeat-enable": "1"}, function _done(frame) {
                assert.isDefined(frame.headers, 'heart-beat');

            }, function _failed(evt) {
                //TODO Error callback should be make a distinction between error frame and close
                // event.
                if (evt && evt.hasOwnProperty("type") && evt["type"] === "close") {
                    assert.isFalse(client.connected);
                    done();

                } else {
                    throw {
                        name: "connectException",
                        message: "connected with error frame."
                    };
                }
            });
        });
    });

    describe('[largeFrame]', function _largeFrame() {

        it('[largeFrame]', function _largeFrameIt(done) {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            let content = '1234567890';
            client.connect({}, function _done() {
                client.maxWebSocketFrameSize = 50;
                client.send('/largeFrame', content, {});

            }, function _failed() {
                throw {
                    name: "connectException",
                    message: "connected with error frame."
                };
            });
            client.onreceive = function _onreceive(frame) {
                assert.notStrictEqual(frame.body, content);
                done();
            }
        });
    });
});