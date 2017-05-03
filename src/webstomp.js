import Client from './client';
import {VERSIONS} from './utils';
import RxClient from './rxclient';
// The `webstomp` Object
const webstomp = {
    VERSIONS,
    // This method creates a WebSocket client that is connected to
    // the STOMP server located at the url.
    client: function(url, options = {protocols: VERSIONS.supportedProtocols()}) {
        let ws = new WebSocket(url, options.protocols);
        return new Client(ws, options);
    },

    // This method creates a Websocket client that is connected to the STOMP server
    rxClient: function(url, options = {protocols: VERSIONS.supportedProtocols()}) {
        let ws = new WebSocket(url, options.protocols);
        return new RxClient(ws, options);
    },
    // This method is an alternative to `webstomp.client()` to let the user
    // specify the WebSocket to use (either a standard HTML5 WebSocket or
    // a similar object).
    over: (...args) => new Client(...args),

    overRx: (...args) => new RxClient(...args)
};

export default webstomp;
