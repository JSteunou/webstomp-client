# webstomp-client

This library provides a [stomp](https://stomp.github.io/) client for Web browsers through Web Sockets.

## Project Status

This is a fork of the original [stomp-websocket](https://github.com/jmesnil/stomp-websocket) re-written in ES6 and incorporate pending pull requests. All credits goes to the original authors: Jeff Mesnil & Jeff Lindsay.

## Browsers support

Only ES5 compatible modern browsers are supported. If you need a websocket polyfill you can use [sockjs](http://sockjs.org)

## nodejs support

Should work over websocket even if the main target is the Browsers. You should fall-back to [stomp-websocket](https://github.com/jmesnil/stomp-websocket) if you encounter issues.

## Example

`npm run example` will open examples in browser and try to connect to [RabbitMQ Web-Stomp](https://www.rabbitmq.com/web-stomp.html) default Web Sockets url.

## Use

`npm install webstomp-client`

### Web browser old fashion style

```html
<script type="text/javascript" src="node_modules/webstomp-client/dist/webstomp.min.js"></script>
```

`webstomp` will be a global variable.

### CommonJS

```js
var webstomp = require('webstomp-client');
```

### ES6 modules

```
import webstomp from 'webstomp-client';
```

By default it will load `dist/webstomp.js`, but the npm package.json es6 entry point to the es6 src file if you prefer loading this version.

## API

Jeff Mesnil stomp-websocket [documentation](http://jmesnil.net/stomp-websocket/doc/) is still a must read even if the API [evolved](CHANGELOG.md) a little

### webstomp

#### client(url, [options])

Uses `WebSocket` to return a webstomp `Client` object.

##### url<String>

Web Sockets endpoint url

##### options<Object>

* protocols: default to `['v10.stomp', 'v11.stomp']`
* binary: default to `false`. See [binary](#binary) section.
* heartbeat: default to `{incoming: 10000, outgoing: 10000}`. You can provide `false` to cut it or a definition object.
* debug: default to `true`. Will log frame using `console.log`

#### over(ws, [options])

Takes a `WebSocket` alike object instance to return a webstomp `Client` object. Allows you to use another Web Sockets object, like sockjs.

##### ws<WebSocket>

`WebSocket` object instance

### Client

A client instance can and should be created through `webstomp.client` or `webstomp.over`

#### connect

* `connect(headers, connectCallback)`
* `connect(headers, connectCallback, errorCallback)`
* `connect(login, passcode, connectCallback)`
* `connect(login, passcode, connectCallback, errorCallback)`
* `connect(login, passcode, connectCallback, errorCallback, host)`

#### disconnect(disconnectCallback, headers={})

#### send(destination, body='', headers={})

#### subscribe(destination, callback, headers={})

#### unsubscribe(id, header={})

It is preferable to unsubscribe from a subscription by calling `unsubscribe()` directly on the object returned by `client.subscribe()`

```js
var subscription = client.subscribe(destination, onmessage);
...
subscription.unsubscribe(headers);
```

`headers` are optionals

#### begin([transaction])

If no transaction ID is passed, one will be created automatically

#### commit(transaction)

It is preferable to commit a transaction by calling `commit()` directly on the object returned by `client.begin()`:

```js
var tx = client.begin(txid);
...
tx.commit();
```

#### abort(transaction)

It is preferable to abort a transaction by calling `abort()` directly on the object returned by `client.begin()`:

```js
var tx = client.begin(txid);
...
tx.abort();
```

#### ack(messageID, subscription, headers={})

It is preferable to acknowledge a message by calling `ack()` directly on the message handled by a subscription callback:

```js
client.subscribe(destination, (message) => {
        // process the message
        // acknowledge it
        message.ack();
    }, {'ack': 'client'}
);
```

#### nack(messageID, subscription, headers={})

It is preferable to nack a message by calling `nack()` directly on the message handled by a subscription callback:

```js
client.subscribe(destination, (message) => {
        // process the message
        // acknowledge it
        message.nack();
    }, {'ack': 'client'}
);
```

#### debug

Will use `console.log` by default. Override it to update its behavior.


## Binary

It is possible to use binary frame instead of string frame over Web Sockets.

* client side: set the binary option to true.
* server side: use a compatible websocket server, like with [RabbitMQ Web-Stomp](https://www.rabbitmq.com/web-stomp.html) since 3.6

## Hearbeat

Not all server are compatible, you may have to deactivate this feature depending the server you are using. For example RabbitMQ Web-Stomp is compatible only since 3.6 with native Web Sockets server.

## Authors

* [Jérôme Steunou](https://github.com/JSteunou)
* [Jeff Mesnil](http://jmesnil.net/)
* [Jeff Lindsay](http://github.com/progrium)
