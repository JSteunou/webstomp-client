/* global expect, describe */
import Frame from './frame';

function convertLines(lines) {
    return lines.join('\n') + '\0';
}

describe('Frame marshaling', () => {
    test('should have content-length header if body is present', () => {
        const result = Frame.marshall('CONNECT', {}, "BODY");
        const expectedLines = [
            'CONNECT',
            'content-length:4',
            '\nBODY'
        ];
        expect(result).toBe(convertLines(expectedLines));
    });
});

describe('Frame unmarshaling', () => {
    test('single simple frame unmarshaling', () => {
        const message = 'CONNECT\n\ntest\0';
        const {frames} = Frame.unmarshall(message);
        expect(frames[0].command).toBe('CONNECT');
        expect(frames[0].headers).toEqual({});
        expect(frames[0].body).toBe('test');
    });
});
