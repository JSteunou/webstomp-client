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
    static unmarshallSingle(data) {
        // search for 2 consecutives LF byte to split the command
        // and headers from the body
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

    // Split the data before unmarshalling every single STOMP frame.
    // Web socket servers can send multiple frames in a single websocket message.
    // If the message size exceeds the websocket message size, then a single
    // frame can be fragmented across multiple messages.
    //
    // `datas` is a string.
    //
    // returns an *array* of Frame objects
    static unmarshall(datas) {
        // split and unmarshall *multiple STOMP frames* contained in a *single WebSocket frame*.
        // The data is split when a NULL byte (followed by zero or many LF bytes) is found
        let frames = datas.split(new RegExp(BYTES.NULL + BYTES.LF + '*')),
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
            r.frames.push(Frame.unmarshallSingle(lastFrame));
        } else {
            r.partial = lastFrame;
        }

        return r;
    }

    // Marshall a Stomp frame
    static marshall(command, headers, body) {
        let frame = new Frame(command, headers, body);
        return frame.toString() + BYTES.NULL;
    }

}

export default Frame;
