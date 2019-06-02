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
    // NULL byte (octet 0)
    NULL: '\x00',
    // LINEFEED byte (octet 10)
    LF: '\x0A',
    // CARRIAGE RETURN byte (octet 13)
    CR: '\x0D',
    // COLON byte (octet 58),
    COLON: '\x3A',
    // BACKSLASH byte (octet 92)
    BACKSLASH: '\x5C',
    // BACKSLASH byte (octet 92) + BACKSLASH byte (octet 92) = \\
    ESCAPED_BACKSLASH: '\x5C' + '\x5C',
    // c byte (octet 99)
    c: '\x63',
    // r byte (octet 114)
    r: '\x72',
    // n byte (octet 110)
    n: '\x6E'
};

const HEADER_ESCAPE_RULES = [
    { pattern: BYTES.LF,    transformed: BYTES.BACKSLASH + BYTES.n, protocols: [VERSIONS.V1_2, VERSIONS.V1_1]},
    { pattern: BYTES.COLON, transformed: BYTES.BACKSLASH + BYTES.c, protocols: [VERSIONS.V1_2, VERSIONS.V1_1]},
    { pattern: BYTES.CR,    transformed: BYTES.BACKSLASH + BYTES.r, protocols: [VERSIONS.V1_2]}
];

const HEADER_UNESCAPE_RULES = [
    { pattern: BYTES.ESCAPED_BACKSLASH + BYTES.n,                 transformed: BYTES.LF,                protocols: [VERSIONS.V1_2, VERSIONS.V1_1]},
    { pattern: BYTES.ESCAPED_BACKSLASH + BYTES.c,                 transformed: BYTES.COLON,             protocols: [VERSIONS.V1_2, VERSIONS.V1_1]},
    { pattern: BYTES.ESCAPED_BACKSLASH + BYTES.ESCAPED_BACKSLASH, transformed: BYTES.ESCAPED_BACKSLASH, protocols: [VERSIONS.V1_2, VERSIONS.V1_1]},
    { pattern: BYTES.ESCAPED_BACKSLASH + BYTES.r,                 transformed: BYTES.CR,                protocols: [VERSIONS.V1_2]}
];

function transformHeader(rules, version, header) {
    rules.forEach(rule => {
        if (!rule.protocols.includes(version)) return;

        header = header.replace(new RegExp(rule.pattern, 'g'), rule.transformed);
    });

    return header;
}

// STOMP 1.1
// All frames except the CONNECT and CONNECTED frames will also escape
// any colon or newline octets found in the resulting UTF-8 encoded headers.
// STOMP 1.2
// All frames except the CONNECT and CONNECTED frames will also escape any
// carriage return, line feed or colon found in the resulting UTF-8 encoded headers.
export function escapeHeader(version, command, header) {
    if (command === 'CONNECT' || command === 'CONNECTED') {
        return header;
    }
    return transformHeader(HEADER_ESCAPE_RULES, version, header);
}

// When decoding frame headers, the following transformations MUST be applied:
// STOMP 1.1
// \n (octet 92 and 110) translates to newline (octet 10)
// \c (octet 92 and 99) translates to : (octet 58)
// \\ (octet 92 and 92) translates to \ (octet 92)
// STOMP 1.2
// \r (octet 92 and 114) translates to carriage return (octet 13)
// \n (octet 92 and 110) translates to line feed (octet 10)
// \c (octet 92 and 99) translates to : (octet 58)
// \\ (octet 92 and 92) translates to \ (octet 92)
export function unescapeHeader(version, header) {
    return transformHeader(HEADER_UNESCAPE_RULES, version, header);
}

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
