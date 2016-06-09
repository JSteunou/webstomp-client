import {assert} from 'chai';
import webstomp from './../src/webstomp';
import SockJS from 'sockjs-client';

describe('[client]', () => {

    let url = 'http://127.0.0.1:1111/stomp';

    describe('[connect]', () => {

        it('[connect fail]', (done) => {
            let sockjs = new SockJS(url + '/fail');
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };

            }, (evt) => {
                if (evt && evt.type && evt.type === 'close') {
                    assert.isFalse(client.connected);
                    done();

                } else {

                    throw {
                        name: 'connectException',
                        message: 'connected with error frame.'
                    };
                }
            });
        });

        it('[connect success]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, (frame) => {
                assert.isDefined(frame, 'command');
                assert.strictEqual(frame.command, 'CONNECTED');
                assert.isTrue(client.connected);
                done();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });

        it('[disconnect]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, (frame) => {
                assert.isTrue(client.connected);
                client.disconnect(() => {
                    assert.isFalse(client.connected);
                    done();
                });
                done();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });

        it('[login]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect('username', 'password', (frame) => {
                assert.isDefined(frame, 'body');
                assert.strictEqual(frame.body, 'login success');
                client.disconnect();
                done();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });
    });

    describe('[send]', () => {
        it('[send and message]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                client.send('/send', 'test', {test: 'test'});

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
            client.onreceive = (frame) => {
                assert.isDefined(frame, 'body');
                assert.strictEqual(frame.body, '0');
                done();
            };
        });
    });

    describe('[error]', () => {
        it('[error]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({'error-enable': '1'}, () => {}, (frame) => {
                if (frame && frame.command === 'ERROR') {
                    client.disconnect();
                    done();

                } else {
                    throw {
                        name: 'connectException',
                        message: 'connected failed.'
                    };
                }
            });
        });
    });

    describe('[receipt]', () => {
        it('[receipt]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({'receipt-enable': '1'}, () => {}, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
            client.onreceipt = (frame) => {
                done();
            }
        });
    });

    describe('[subscribe]', () => {

        let sockjs;
        let client;
        let sub;

        before((done)=> {
            sockjs = new SockJS(url);
            client = webstomp.over(sockjs);
            sub = {};
            client.connect({}, () => {
                done();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });

        it('[subscribe and message]', (done) => {
            sub = client.subscribe('/channel', (frame) => {
                assert.isDefined(sub, 'id');
                assert.isDefined(client.subscriptions[sub.id]);
                assert.strictEqual(client.counter, 1);

                assert.isDefined(frame, 'body');
                assert.strictEqual(frame.body, '0');

                done();
            });
        });

        it('[subscribe and unsubscribe', (done) => {
            assert.isDefined(sub, 'unsubscribe');
            sub.unsubscribe();
            client.onreceive = (frame) => {
                assert.isDefined(frame.headers, 'id');
                assert.strictEqual(frame.headers.id, sub.id);
                done();
            };
        });
    });

    describe('[transaction]', () => {

        it('[ack]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                let sub = client.subscribe('/ack', (frame) => {
                    assert.isDefined(frame, 'ack');
                    frame.ack();
                });
                client.onreceive = (frame) => {
                    assert.strictEqual(frame.body, 'ack success');
                    sub.unsubscribe();
                    client.disconnect();
                    done();
                };

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });

        it('[nack]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                let sub = client.subscribe('/nack', (frame) => {
                    assert.isDefined(frame, 'nack');
                    frame.nack();
                });
                client.onreceive = (frame) => {
                    assert.strictEqual(frame.body, 'nack success');
                    sub.unsubscribe();
                    client.disconnect();
                    done();
                };

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });

        it('[begin and commit]', (done) => {

            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                let tran;
                client.onreceive = (frame) => {
                    assert.strictEqual(frame.body, 'begin success');
                    assert.isDefined(tran, 'id');
                    assert.isDefined(tran, 'commit');
                    assert.isDefined(tran, 'abort');
                    tran.commit();

                    client.onreceive = (frame) => {
                        assert.strictEqual(frame.body, 'commit success');
                        client.disconnect();
                        done();
                    };
                };
                tran = client.begin();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });

        it('[begin and abort]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                let tran;
                client.onreceive = (frame) => {
                    assert.strictEqual(frame.body, 'begin success');

                    assert.isDefined(tran, 'id');
                    assert.isDefined(tran, 'commit');
                    assert.isDefined(tran, 'abort');
                    tran.abort();

                    client.onreceive = (frame) => {
                        assert.strictEqual(frame.body, 'abort success');
                        client.disconnect();
                        done();
                    };
                };
                tran = client.begin();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });

        });

        it('[begin commit and abort]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            client.connect({}, () => {
                let tran;
                client.onreceive = (frame) => {
                    assert.strictEqual(frame.body, 'begin success');
                    assert.isDefined(tran, 'id');
                    assert.isDefined(tran, 'commit');
                    assert.isDefined(tran, 'abort');
                    tran.commit();

                    client.onreceive = (frame) => {
                        assert.strictEqual(frame.body, 'commit success');
                        tran.abort();

                        client.onreceive = (frame) => {
                            assert.strictEqual(frame.body, 'abort failed');
                            client.disconnect();
                            done();
                        };
                    };
                };
                tran = client.begin();

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected failed.'
                };
            });
        });
    });

    describe('[heartbeat]', () => {

        it('[heartbeat disconnect]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs, {heartbeat: {outgoing: 10, incoming: 10}});
            client.connect({'heartbeat-enable': '1'}, (frame) => {
                assert.isDefined(frame.headers, 'heart-beat');

            }, (evt) => {
                if (evt && evt.type && evt.type === 'close') {
                    assert.isFalse(client.connected);
                    done();

                } else {
                    throw {
                        name: 'connectException',
                        message: 'connected with error frame.'
                    };
                }
            });
        });
    });

    describe('[largeFrame]', () => {

        it('[largeFrame]', (done) => {
            let sockjs = new SockJS(url);
            let client = webstomp.over(sockjs);
            let content = '1234567890';
            client.connect({}, () => {
                client.maxWebSocketFrameSize = 50;
                client.send('/largeFrame', content, {});

            }, () => {
                throw {
                    name: 'connectException',
                    message: 'connected with error frame.'
                };
            });
            client.onreceive = (frame) => {
                assert.notStrictEqual(frame.body, content);
                done();
            }
        });
    });
});
