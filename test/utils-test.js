import {assert} from 'chai';
import * as utils from './../src/utils';

describe('utils', () => {

    it('trim', () => {
        assert.strictEqual(utils.trim('test'), 'test');
        assert.strictEqual(utils.trim('  test'), 'test');
        assert.strictEqual(utils.trim('test  '), 'test');
        assert.strictEqual(utils.trim('\f\n\r\t\v\u00a0\u1680\u2028\u2029\u202f\u205f\u3000\ufeff'), '');

        assert.throws(() => {
            utils.trim(1)
        }, TypeError);
        assert.throws(() => {
            utils.trim(Object())
        }, TypeError);
    });

    it('unicodeStringToTypedArray', () => {
        assert.deepEqual(utils.unicodeStringToTypedArray(' test '), new Uint8Array([32, 116, 101, 115, 116, 32]));
        assert.deepEqual(utils.unicodeStringToTypedArray(''), new Uint8Array([]));
        assert.deepEqual(utils.unicodeStringToTypedArray(JSON.stringify({test: 'test'})),
            new Uint8Array([123, 34, 116, 101, 115, 116, 34, 58, 34, 116, 101, 115, 116, 34, 125]));
    });

    it('typedArrayToUnicodeString', () => {
        assert.strictEqual(utils.typedArrayToUnicodeString([32, 116, 101, 115, 116, 32]), ' test ');
        assert.strictEqual(utils.typedArrayToUnicodeString([49]), '1');
        assert.strictEqual(utils.typedArrayToUnicodeString([]), '');
        assert.strictEqual(utils.typedArrayToUnicodeString([123, 34, 116, 101, 115, 116, 34, 58, 34, 116, 101, 115, 116, 34, 125]),
            JSON.stringify({test: 'test'}));
    });

    it('sizeOfUTF8', () => {
        assert.strictEqual(utils.sizeOfUTF8(undefined), 0);
        assert.strictEqual(utils.sizeOfUTF8(null), 0);
        assert.strictEqual(utils.sizeOfUTF8(''), 0);
        assert.strictEqual(utils.sizeOfUTF8('test'), 4);
        assert.strictEqual(utils.sizeOfUTF8('  test  '), 8);
        assert.strictEqual(utils.sizeOfUTF8(JSON.stringify({test: 'test'})), 15);
    });
});
