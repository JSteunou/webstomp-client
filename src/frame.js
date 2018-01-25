import {BYTES, sizeOfUTF8, trim} from './utils';

// [STOMP Frame](http://stomp.github.com/stomp-specification-1.1.html#STOMP_Frames) Class
class Frame {

    // Frame constructor
    constructor(command, headers = {}, body = '') {
        this.command = command;
        this.headers = headers;
        this.body = body;
    }

    // Provides a textual representation of the frame
    // suitable to be sent to the server
    toString() {
        let lines = [this.command],
            skipContentLength = this.headers['content-length'] === false
        ;
        if (skipContentLength) delete this.headers['content-length'];

        Object.keys(this.headers).forEach(name => {
            let value = this.headers[name];
            lines.push(`${name}:${value}`);
        });

        if (this.body && !skipContentLength) {
            lines.push(`content-length:${sizeOfUTF8(this.body)}`);
        }

        lines.push(BYTES.LF + this.body);

        return lines.join(BYTES.LF);
    }

    // Unmarshall a single STOMP frame from a `data` string
    static unmarshallTextSingle(data) {
        // search for 2 consecutives LF byte to split the command
        // and headers from the bodyc
        let divider = data.search(new RegExp(BYTES.LF + BYTES.LF)),
            headerLines = data.substring(0, divider).split(BYTES.LF),
            command = headerLines.shift(),
            headers = {},
            body = '',
            // skip the 2 LF bytes that divides the headers from the body
            bodyIndex = divider + 2;

        // Parse headers in reverse order so that for repeated headers, the 1st
        // value is used
        for (let line of headerLines.reverse()) {
            let idx = line.indexOf(':');
            headers[trim(line.substring(0, idx))] = trim(line.substring(idx + 1));
        }
        // Parse body
        // check for content-length or topping at the first NULL byte found.
        if (headers['content-length']) {
            let len = parseInt(headers['content-length'], 10);
            body = ('' + data).substring(bodyIndex, bodyIndex + len);
        } else {
            let chr = null;
            for (let i = bodyIndex; i < data.length; i++) {
                chr = data.charAt(i);
                if (chr === BYTES.NULL) break;
                body += chr;
            }
        }

        return new Frame(command, headers, body);
    }

    // split and unmarshall *multiple STOMP frames* contained in a *single WebSocket frame*.
    // The data is split when a NULL byte (followed by zero or many LF bytes) is found
    static unmarshallText(data) {
        // Split the data before unmarshalling every single STOMP frame.
        // Web socket servers can send multiple frames in a single websocket message.
        // If the message size exceeds the websocket message size, then a single
        // frame can be fragmented across multiple messages.
        //
        // `data` is a string.

        if (data === BYTES.LF) {
            return { frames: [{ type: 'heartbeat' }] }
        }
        let frames = data.split(new RegExp(BYTES.NULL + BYTES.LF + '*')),
            firstFrames = frames.slice(0, -1),
            lastFrame = frames.slice(-1)[0],
            r = {
                frames: firstFrames.map(f => Frame.unmarshallSingle(f)),
                partial: ''
            };

        // If this contains a final full message or just a acknowledgement of a PING
        // without any other content, process this frame, otherwise return the
        // contents of the buffer to the caller.
        if (lastFrame === BYTES.LF || (lastFrame.search(RegExp(BYTES.NULL + BYTES.LF + '*$'))) !== -1) {
            r.frames.push(Frame.unmarshallTextSingle(lastFrame));
        } else {
            r.partial = lastFrame;
        }

        return r;
    }

    static unmarshallBinarySingle(data) {
        let headerBlock;
        let body;

        for (let i = 0; i < data.length; i++) {
            if (data[i] === BYTES.LF_CODE && data[i + 1] === BYTES.LF_CODE) {
                headerBlock = data.slice(0, i + 1)
                body = data.slice(i + 2, data.length - 1)
                break
            }
        }

        let headerLines = []
        let divider = 0
        for (let i = 0; i < headerBlock.length; i++) {
            if (headerBlock[i] === BYTES.LF_CODE) {
                headerLines.push(headerBlock.slice(divider, i))
                divider = i + 1
            }
        }

        let command = String.fromCharCode(...headerLines.shift())

        let headers = {}
        for (let i = 0; i < headerLines.length; i++) {
            const line = String.fromCharCode(...headerLines[i]).split(':')
            headers[line[0]] = line[1]
        }
        return new Frame(command, headers, body);
    }

    static unmarshallBinary(partialData, data) {
        data = new Uint8Array(data)
        const datas = partialData ? partialData + new Uint8Array([...partialData, ...data]) : data
        if (datas.length === 1 && datas[0] === BYTES.LF_CODE) {
            return { frames: [{ type: 'heartbeat' }] }
        }

        return {
            frames: [this.unmarshallBinarySingle(datas)]
        }
    }

    static unmarshall(partialData, data, isBinary) {
        // if (data instanceof ArrayBuffer) {
        //     return this.unmarshallBinary(partialData, data)
        // }
        if (isBinary) {
            return this.unmarshallBinary(partialData, data)
        }

        const datas = partialData + data
        return this.unmarshallText(datas)
    }

    // Marshall a Stomp frame
    static marshall(command, headers, body) {
        let frame = new Frame(command, headers, body);
        return frame.toString() + BYTES.NULL;
    }

}

export default Frame;
