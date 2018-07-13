import Client from './client';
import Frame from './frame';
import {VERSIONS} from './utils';

// The `webstomp` Object
const webstomp = {
    Frame,
    VERSIONS,
    // This method creates a WebSocket client that is connected to
    // the STOMP server located at the url.
    client(url, options = {}) {
        let ws = new WebSocket(url, options.protocols || VERSIONS.supportedProtocols());
        return new Client(ws, options);
    },
    // This method is an alternative to `webstomp.client()` to let the user
    // specify the WebSocket to use (either a standard HTML5 WebSocket or
    // a similar object).
    over: (...args) => new Client(...args)
};

export default webstomp;
