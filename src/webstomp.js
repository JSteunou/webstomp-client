import Client from './client';
import {VERSIONS} from './utils';

export {default as Frame} from './frame';

// The `webstomp` Object
const webstomp = {
    VERSIONS,
    // This method creates a WebSocket client that is connected to
    // the STOMP server located at the url.
    client: function(url, options = {}) {
        let ws = new WebSocket(url, options.protocols || VERSIONS.supportedProtocols());
        return new Client(ws, options);
    },
    // This method is an alternative to `webstomp.client()` to let the user
    // specify the WebSocket to use (either a standard HTML5 WebSocket or
    // a similar object).
    over: (...args) => new Client(...args)
};

export default webstomp;
