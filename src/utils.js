export const VERSIONS = {
    V1_0: '1.0',
    V1_1: '1.1',
    V1_2: '1.2',
    // Versions of STOMP specifications supported
    supportedVersions: () => '1.2,1.1,1.0',
    supportedProtocols: () => ['v10.stomp', 'v11.stomp', 'v12.stomp']
};

export const PROTOCOLS_VERSIONS = {
    'v10.stomp': VERSIONS.V1_0,
    'v11.stomp': VERSIONS.V1_1,
    'v12.stomp': VERSIONS.V1_2
};

export function getSupportedVersion(protocol, debug) {
    const knownVersion = PROTOCOLS_VERSIONS[protocol];
    if (!knownVersion && debug) {
        debug(`DEPRECATED: ${protocol} is not a recognized STOMP version. In next major client version, this will close the connection.`);
    }
    // 2nd temporary fallback if the protocol
    // does not match a supported STOMP version
    // This fallback will be removed in next major version
    return knownVersion || VERSIONS.V1_2;
}

// Define constants for bytes used throughout the code.
export const BYTES = {
    // LINEFEED byte (octet 10)
    LF: '\x0A',
    // NULL byte (octet 0)
    NULL: '\x00'
};

// utility function to trim any whitespace before and after a string
export const trim = (str) => str.replace(/^\s+|\s+$/g, '');

// from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
export function unicodeStringToTypedArray(s) {
    let escstr = encodeURIComponent(s);
    let binstr = escstr.replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1));
    let arr = Array.prototype.map.call(binstr, (c) => c.charCodeAt(0));
    return new Uint8Array(arr);
}

// from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
export function typedArrayToUnicodeString(ua) {
    let binstr = String.fromCharCode(...ua);
    let escstr = binstr.replace(/(.)/g, function(m, p) {
        let code = p.charCodeAt(0).toString(16).toUpperCase();
        if (code.length < 2) {
            code = '0' + code;
        }
        return '%' + code;
    });
    return decodeURIComponent(escstr);
}

// Compute the size of a UTF-8 string by counting its number of bytes
// (and not the number of characters composing the string)
export function sizeOfUTF8(s) {
    if (!s) return 0;
    return encodeURIComponent(s).match(/%..|./g).length;
}

export function createId() {
    const ts = (new Date()).getTime();
    const rand = Math.floor(Math.random() * 1000);
    return `${ts}-${rand}`;
}
