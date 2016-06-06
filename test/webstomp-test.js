import {assert} from "chai";
import {VERSIONS} from "./../src/utils";
import webstomp from "./../src/webstomp";
import Client from "./../src/client";
import SockJS from "sockjs-client";

describe('webstomp', function _webstomp() {

    it('client', function _client() {
        assert.instanceOf(webstomp.client("ws://127.0.0.1:1111/stomp"), Client);
    });

    it('over', function _over() {
        let ws = new WebSocket("ws://127.0.0.1:1111/stomp", VERSIONS.supportedProtocols());
        assert.instanceOf(webstomp.over(ws), Client);
    });

    it('overWithSockJS', function _overWithSockJS() {
        let sockjs = new SockJS("http://127.0.0.1:1111/stomp");
        assert.instanceOf(webstomp.over(sockjs), Client);
    });
});