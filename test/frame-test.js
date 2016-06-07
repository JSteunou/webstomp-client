import {assert} from "chai";
import {VERSIONS, BYTES} from "./../src/utils";
import Frame from "./../src/frame";

describe('Frame', function _webstomp() {

    it('toString', function _toString() {
        let frameStr = [
            'CONNECT',
            'accept-version:' + VERSIONS.supportedVersions(),
            'heart-beat:0,0',
            BYTES.LF
        ].join(BYTES.LF);
        let frame = new Frame(
            'CONNECT', {
                'accept-version': VERSIONS.supportedVersions(),
                'heart-beat': '0,0'
            }
        );
        assert.strictEqual(frame.toString(), frameStr);
    });

    it('toStringWithBody', function _toStringWithBody() {
        let frameStr = [
            'MESSAGE',
            'content-length:4',
            BYTES.LF + "test"
        ].join(BYTES.LF);
        let frame = new Frame('MESSAGE', {}, 'test');
        assert.strictEqual(frame.toString(), frameStr);
    });

    it('toStringIgnoreLength', function _toStringIgnoreLength() {
        let frameStr = [
            'MESSAGE',
            BYTES.LF + "test"
        ].join(BYTES.LF);
        let frame = new Frame('MESSAGE', {'content-length': false}, 'test');
        assert.strictEqual(frame.toString(), frameStr);
    });

    it('marshall and unmarshallSingle', function _single() {
        let frame = new Frame('MESSAGE', {'content-length': '4'}, 'test');
        let data = Frame.marshall('MESSAGE', {}, 'test');
        assert.deepEqual(Frame.unmarshallSingle(data), frame);

        data = Frame.marshall('MESSAGE', {'content-length': false}, 'test');
        assert.deepEqual(Frame.unmarshallSingle(data), new Frame('MESSAGE', {}, 'test'));
    });

    it('unmarshall', function _unmarshall() {
        let frame = new Frame('MESSAGE', {'content-length': '4'}, 'test');
        let data = Frame.marshall('MESSAGE', {}, 'test');
        let r = Frame.unmarshall(data + "test");

        assert.deepEqual(r.frames[0], frame);
        assert.strictEqual(r.partial, "test");
    });

    it('unmarshall multiple', function _multiUnmarshall() {
        let frame = new Frame('MESSAGE', {'content-length': '4'}, 'test');
        let data = Frame.marshall('MESSAGE', {}, 'test');
        let r = Frame.unmarshall(data + data);

        assert.strictEqual(r.frames.length, 2);
        assert.deepEqual(r.frames[0], frame);
        assert.deepEqual(r.frames[1], frame);
        assert.strictEqual(r.partial, "");

    });
});