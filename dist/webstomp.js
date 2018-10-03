(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.webstomp = factory());
}(this, (function () { 'use strict';

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var slicedToArray = function () {
    function sliceIterator(arr, i) {
      var _arr = [];
      var _n = true;
      var _d = false;
      var _e = undefined;

      try {
        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
          _arr.push(_s.value);

          if (i && _arr.length === i) break;
        }
      } catch (err) {
        _d = true;
        _e = err;
      } finally {
        try {
          if (!_n && _i["return"]) _i["return"]();
        } finally {
          if (_d) throw _e;
        }
      }

      return _arr;
    }

    return function (arr, i) {
      if (Array.isArray(arr)) {
        return arr;
      } else if (Symbol.iterator in Object(arr)) {
        return sliceIterator(arr, i);
      } else {
        throw new TypeError("Invalid attempt to destructure non-iterable instance");
      }
    };
  }();

  var toConsumableArray = function (arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

      return arr2;
    } else {
      return Array.from(arr);
    }
  };

  var VERSIONS = {
      V1_0: '1.0',
      V1_1: '1.1',
      V1_2: '1.2',
      // Versions of STOMP specifications supported
      supportedVersions: function supportedVersions() {
          return '1.2,1.1,1.0';
      },
      supportedProtocols: function supportedProtocols() {
          return ['v10.stomp', 'v11.stomp', 'v12.stomp'];
      }
  };

  var PROTOCOLS_VERSIONS = {
      'v10.stomp': VERSIONS.V1_0,
      'v11.stomp': VERSIONS.V1_1,
      'v12.stomp': VERSIONS.V1_2
  };

  function getSupportedVersion(protocol, debug) {
      var knownVersion = PROTOCOLS_VERSIONS[protocol];
      if (!knownVersion && debug) {
          debug('DEPRECATED: ' + protocol + ' is not a recognized STOMP version. In next major client version, this will close the connection.');
      }
      // 2nd temporary fallback if the protocol
      // does not match a supported STOMP version
      // This fallback will be removed in next major version
      return knownVersion || VERSIONS.V1_2;
  }

  // Define constants for bytes used throughout the code.
  var BYTES = {
      // LINEFEED byte (octet 10)
      LF: '\x0A',
      // NULL byte (octet 0)
      NULL: '\x00'
  };

  // utility function to trim any whitespace before and after a string
  var trim = function trim(str) {
      return str.replace(/^\s+|\s+$/g, '');
  };

  // from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
  function unicodeStringToTypedArray(s) {
      var escstr = encodeURIComponent(s);
      var binstr = escstr.replace(/%([0-9A-F]{2})/g, function (match, p1) {
          return String.fromCharCode('0x' + p1);
      });
      var arr = Array.prototype.map.call(binstr, function (c) {
          return c.charCodeAt(0);
      });
      return new Uint8Array(arr);
  }

  // from https://coolaj86.com/articles/unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
  function typedArrayToUnicodeString(ua) {
      var binstr = String.fromCharCode.apply(String, toConsumableArray(ua));
      var escstr = binstr.replace(/(.)/g, function (m, p) {
          var code = p.charCodeAt(0).toString(16).toUpperCase();
          if (code.length < 2) {
              code = '0' + code;
          }
          return '%' + code;
      });
      return decodeURIComponent(escstr);
  }

  // Compute the size of a UTF-8 string by counting its number of bytes
  // (and not the number of characters composing the string)
  function sizeOfUTF8(s) {
      if (!s) return 0;
      return encodeURIComponent(s).match(/%..|./g).length;
  }

  function createId() {
      var ts = new Date().getTime();
      var rand = Math.floor(Math.random() * 1000);
      return ts + '-' + rand;
  }

  // [STOMP Frame](http://stomp.github.com/stomp-specification-1.1.html#STOMP_Frames) Class

  var Frame = function () {

      // Frame constructor
      function Frame(command) {
          var headers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
          var body = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
          classCallCheck(this, Frame);

          this.command = command;
          this.headers = headers;
          this.body = body;
      }

      // Provides a textual representation of the frame
      // suitable to be sent to the server


      createClass(Frame, [{
          key: 'toString',
          value: function toString() {
              var _this = this;

              var lines = [this.command],
                  skipContentLength = this.headers['content-length'] === false;
              if (skipContentLength) delete this.headers['content-length'];

              Object.keys(this.headers).forEach(function (name) {
                  var value = _this.headers[name];
                  lines.push(name + ':' + value);
              });

              if (this.body && !skipContentLength) {
                  lines.push('content-length:' + sizeOfUTF8(this.body));
              }

              lines.push(BYTES.LF + this.body);

              return lines.join(BYTES.LF);
          }

          // Unmarshall a single STOMP frame from a `data` string

      }], [{
          key: 'unmarshallSingle',
          value: function unmarshallSingle(data) {
              // search for 2 consecutives LF byte to split the command
              // and headers from the body
              var divider = data.search(new RegExp(BYTES.LF + BYTES.LF)),
                  headerLines = data.substring(0, divider).split(BYTES.LF),
                  command = headerLines.shift(),
                  headers = {},
                  body = '',

              // skip the 2 LF bytes that divides the headers from the body
              bodyIndex = divider + 2;

              // Parse headers in reverse order so that for repeated headers, the 1st
              // value is used
              var _iteratorNormalCompletion = true;
              var _didIteratorError = false;
              var _iteratorError = undefined;

              try {
                  for (var _iterator = headerLines.reverse()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                      var line = _step.value;

                      var idx = line.indexOf(':');
                      headers[trim(line.substring(0, idx))] = trim(line.substring(idx + 1));
                  }
                  // Parse body
                  // check for content-length or topping at the first NULL byte found.
              } catch (err) {
                  _didIteratorError = true;
                  _iteratorError = err;
              } finally {
                  try {
                      if (!_iteratorNormalCompletion && _iterator.return) {
                          _iterator.return();
                      }
                  } finally {
                      if (_didIteratorError) {
                          throw _iteratorError;
                      }
                  }
              }

              if (headers['content-length']) {
                  var len = parseInt(headers['content-length'], 10);
                  body = ('' + data).substring(bodyIndex, bodyIndex + len);
              } else {
                  var chr = null;
                  for (var i = bodyIndex; i < data.length; i++) {
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

      }, {
          key: 'unmarshall',
          value: function unmarshall(datas) {
              // split and unmarshall *multiple STOMP frames* contained in a *single WebSocket frame*.
              // The data is split when a NULL byte (followed by zero or many LF bytes) is found
              var frames = datas.split(new RegExp(BYTES.NULL + BYTES.LF + '*')),
                  firstFrames = frames.slice(0, -1),
                  lastFrame = frames.slice(-1)[0],
                  r = {
                  frames: firstFrames.map(function (f) {
                      return Frame.unmarshallSingle(f);
                  }),
                  partial: ''
              };

              // If this contains a final full message or just a acknowledgement of a PING
              // without any other content, process this frame, otherwise return the
              // contents of the buffer to the caller.
              if (lastFrame === BYTES.LF || lastFrame.search(RegExp(BYTES.NULL + BYTES.LF + '*$')) !== -1) {
                  r.frames.push(Frame.unmarshallSingle(lastFrame));
              } else {
                  r.partial = lastFrame;
              }

              return r;
          }

          // Marshall a Stomp frame

      }, {
          key: 'marshall',
          value: function marshall(command, headers, body) {
              var frame = new Frame(command, headers, body);
              return frame.toString() + BYTES.NULL;
          }
      }]);
      return Frame;
  }();

  // STOMP Client Class
  //
  // All STOMP protocol is exposed as methods of this class (`connect()`,
  // `send()`, etc.)

  var Client = function () {
      function Client(ws) {
          var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
          classCallCheck(this, Client);

          // cannot have default options object + destructuring in the same time in method signature
          var _options$binary = options.binary,
              binary = _options$binary === undefined ? false : _options$binary,
              _options$heartbeat = options.heartbeat,
              heartbeat = _options$heartbeat === undefined ? { outgoing: 10000, incoming: 10000 } : _options$heartbeat,
              _options$debug = options.debug,
              debug = _options$debug === undefined ? true : _options$debug,
              _options$protocols = options.protocols,
              protocols = _options$protocols === undefined ? [] : _options$protocols;


          this.ws = ws;
          this.ws.binaryType = 'arraybuffer';
          this.isBinary = !!binary;
          this.hasDebug = !!debug;
          this.connected = false;
          // Heartbeat properties of the client
          // outgoing: send heartbeat every 10s by default (value is in ms)
          // incoming: expect to receive server heartbeat at least every 10s by default
          // falsy value means no heartbeat hence 0,0
          this.heartbeat = heartbeat || { outgoing: 0, incoming: 0 };
          // maximum *WebSocket* frame size sent by the client. If the STOMP frame
          // is bigger than this value, the STOMP frame will be sent using multiple
          // WebSocket frames (default is 16KiB)
          this.maxWebSocketFrameSize = 16 * 1024;
          // subscription callbacks indexed by subscriber's ID
          this.subscriptions = {};
          this.partialData = '';
          this.protocols = protocols;
      }

      // //// Debugging
      //
      // By default, debug messages are logged in the window's console if it is defined.
      // This method is called for every actual transmission of the STOMP frames over the
      // WebSocket.
      //
      // It is possible to set a `debug(message, data)` method
      // on a client instance to handle differently the debug messages:
      //
      //     client.debug = function(str) {
      //         // append the debug log to a #debug div
      //         $("#debug").append(str + "\n");
      //     };


      createClass(Client, [{
          key: 'debug',
          value: function debug() {
              var _console;

              if (this.hasDebug) (_console = console).log.apply(_console, arguments);
          }

          // [CONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECT_or_STOMP_Frame)
          //
          // The `connect` method accepts different number of arguments and types:
          //
          // * `connect(headers, connectCallback)`
          // * `connect(headers, connectCallback, errorCallback)`
          // * `connect(login, passcode, connectCallback)`
          // * `connect(login, passcode, connectCallback, errorCallback)`
          // * `connect(login, passcode, connectCallback, errorCallback, host)`
          //
          // The errorCallback is optional and the 2 first forms allow to pass other
          // headers in addition to `client`, `passcode` and `host`.

      }, {
          key: 'connect',
          value: function connect() {
              var _this = this;

              var _parseConnect2 = this._parseConnect.apply(this, arguments),
                  _parseConnect3 = slicedToArray(_parseConnect2, 3),
                  headers = _parseConnect3[0],
                  connectCallback = _parseConnect3[1],
                  errorCallback = _parseConnect3[2];

              this.connectCallback = connectCallback;
              this.debug('Opening Web Socket...');
              this.ws.onmessage = function (evt) {
                  var data = evt.data;
                  if (evt.data instanceof ArrayBuffer) {
                      data = typedArrayToUnicodeString(new Uint8Array(evt.data));
                  }
                  _this.serverActivity = Date.now();
                  // heartbeat
                  if (data === BYTES.LF) {
                      _this.debug('<<< PONG');
                      return;
                  }
                  _this.debug('<<< ' + data);
                  // Handle STOMP frames received from the server
                  // The unmarshall function returns the frames parsed and any remaining
                  // data from partial frames.
                  var unmarshalledData = Frame.unmarshall(_this.partialData + data);
                  _this.partialData = unmarshalledData.partial;
                  unmarshalledData.frames.forEach(function (frame) {
                      switch (frame.command) {
                          // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
                          case 'CONNECTED':
                              _this.debug('connected to server ' + frame.headers.server);
                              _this.connected = true;
                              _this.version = frame.headers.version;
                              _this._setupHeartbeat(frame.headers);
                              if (connectCallback) connectCallback(frame);
                              break;
                          // [MESSAGE Frame](http://stomp.github.com/stomp-specification-1.1.html#MESSAGE)
                          case 'MESSAGE':
                              // the `onreceive` callback is registered when the client calls
                              // `subscribe()`.
                              // If there is registered subscription for the received message,
                              // we used the default `onreceive` method that the client can set.
                              // This is useful for subscriptions that are automatically created
                              // on the browser side (e.g. [RabbitMQ's temporary
                              // queues](http://www.rabbitmq.com/stomp.html)).
                              var subscription = frame.headers.subscription;
                              var onreceive = _this.subscriptions[subscription] || _this.onreceive;
                              if (onreceive) {
                                  // 1.2 define ack header if ack is set to client
                                  // and this header must be used for ack/nack
                                  var messageID = _this.version === VERSIONS.V1_2 && frame.headers.ack || frame.headers['message-id'];
                                  // add `ack()` and `nack()` methods directly to the returned frame
                                  // so that a simple call to `message.ack()` can acknowledge the message.
                                  frame.ack = _this.ack.bind(_this, messageID, subscription);
                                  frame.nack = _this.nack.bind(_this, messageID, subscription);
                                  onreceive(frame);
                              } else {
                                  _this.debug('Unhandled received MESSAGE: ' + frame);
                              }
                              break;
                          // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
                          //
                          // The client instance can set its `onreceipt` field to a function taking
                          // a frame argument that will be called when a receipt is received from
                          // the server:
                          //
                          //     client.onreceipt = function(frame) {
                          //       receiptID = frame.headers['receipt-id'];
                          //       ...
                          //     }
                          case 'RECEIPT':
                              if (_this.onreceipt) _this.onreceipt(frame);
                              break;
                          // [ERROR Frame](http://stomp.github.com/stomp-specification-1.1.html#ERROR)
                          case 'ERROR':
                              if (errorCallback) errorCallback(frame);
                              break;
                          default:
                              _this.debug('Unhandled frame: ' + frame);
                      }
                  });
              };
              this.ws.onclose = function (event) {
                  _this.debug('Whoops! Lost connection to ' + _this.ws.url + ':', { event: event });
                  _this._cleanUp();
                  if (errorCallback) errorCallback(event);
              };
              this.ws.onopen = function () {
                  _this.debug('Web Socket Opened...');
                  // 1st protocol fallback on user 1st protocols options
                  // to prevent edge case where server does not comply and respond with a choosen protocol
                  // or when ws client does not handle protocol property very well
                  headers['accept-version'] = getSupportedVersion(_this.ws.protocol || _this.protocols[0], _this.debug.bind(_this));
                  // Check if we already have heart-beat in headers before adding them
                  if (!headers['heart-beat']) {
                      headers['heart-beat'] = [_this.heartbeat.outgoing, _this.heartbeat.incoming].join(',');
                  }
                  _this._transmit('CONNECT', headers);
              };
              if (this.ws.readyState === this.ws.OPEN) {
                  this.ws.onopen();
              }
          }

          // [DISCONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#DISCONNECT)

      }, {
          key: 'disconnect',
          value: function disconnect(disconnectCallback) {
              var headers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

              this._transmit('DISCONNECT', headers);
              // Discard the onclose callback to avoid calling the errorCallback when
              // the client is properly disconnected.
              this.ws.onclose = null;
              this.ws.close();
              this._cleanUp();
              // TODO: what's the point of this callback disconnect is not async
              if (disconnectCallback) disconnectCallback();
          }

          // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
          //
          // * `destination` is MANDATORY.

      }, {
          key: 'send',
          value: function send(destination) {
              var body = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
              var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

              var hdrs = Object.assign({}, headers);
              hdrs.destination = destination;
              this._transmit('SEND', hdrs, body);
          }

          // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
          //
          // If no transaction ID is passed, one will be created automatically

      }, {
          key: 'begin',
          value: function begin() {
              var transaction = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'tx-' + createId();

              this._transmit('BEGIN', { transaction: transaction });
              return {
                  id: transaction,
                  commit: this.commit.bind(this, transaction),
                  abort: this.abort.bind(this, transaction)
              };
          }

          // [COMMIT Frame](http://stomp.github.com/stomp-specification-1.1.html#COMMIT)
          //
          // * `transaction` is MANDATORY.
          //
          // It is preferable to commit a transaction by calling `commit()` directly on
          // the object returned by `client.begin()`:
          //
          //     var tx = client.begin(txid);
          //     ...
          //     tx.commit();

      }, {
          key: 'commit',
          value: function commit(transaction) {
              this._transmit('COMMIT', { transaction: transaction });
          }

          // [ABORT Frame](http://stomp.github.com/stomp-specification-1.1.html#ABORT)
          //
          // * `transaction` is MANDATORY.
          //
          // It is preferable to abort a transaction by calling `abort()` directly on
          // the object returned by `client.begin()`:
          //
          //     var tx = client.begin(txid);
          //     ...
          //     tx.abort();

      }, {
          key: 'abort',
          value: function abort(transaction) {
              this._transmit('ABORT', { transaction: transaction });
          }

          // [ACK Frame](http://stomp.github.com/stomp-specification-1.1.html#ACK)
          //
          // * `messageID` & `subscription` are MANDATORY.
          //
          // It is preferable to acknowledge a message by calling `ack()` directly
          // on the message handled by a subscription callback:
          //
          //     client.subscribe(destination,
          //       function(message) {
          //         // process the message
          //         // acknowledge it
          //         message.ack();
          //       },
          //       {'ack': 'client'}
          //     );

      }, {
          key: 'ack',
          value: function ack(messageID, subscription) {
              var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

              var hdrs = Object.assign({}, headers);
              // 1.2 change id header name from message-id to id
              var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
              hdrs[idAttr] = messageID;
              hdrs.subscription = subscription;
              this._transmit('ACK', hdrs);
          }

          // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
          //
          // * `messageID` & `subscription` are MANDATORY.
          //
          // It is preferable to nack a message by calling `nack()` directly on the
          // message handled by a subscription callback:
          //
          //     client.subscribe(destination,
          //       function(message) {
          //         // process the message
          //         // an error occurs, nack it
          //         message.nack();
          //       },
          //       {'ack': 'client'}
          //     );

      }, {
          key: 'nack',
          value: function nack(messageID, subscription) {
              var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

              var hdrs = Object.assign({}, headers);
              // 1.2 change id header name from message-id to id
              var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
              hdrs[idAttr] = messageID;
              hdrs.subscription = subscription;
              this._transmit('NACK', hdrs);
          }

          // [SUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#SUBSCRIBE)

      }, {
          key: 'subscribe',
          value: function subscribe(destination, callback) {
              var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

              var hdrs = Object.assign({}, headers);
              // for convenience if the `id` header is not set, we create a new one for this client
              // that will be returned to be able to unsubscribe this subscription
              if (!hdrs.id) hdrs.id = 'sub-' + createId();
              hdrs.destination = destination;
              this.subscriptions[hdrs.id] = callback;
              this._transmit('SUBSCRIBE', hdrs);
              return {
                  id: hdrs.id,
                  unsubscribe: this.unsubscribe.bind(this, hdrs.id)
              };
          }

          // [UNSUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#UNSUBSCRIBE)
          //
          // * `id` is MANDATORY.
          //
          // It is preferable to unsubscribe from a subscription by calling
          // `unsubscribe()` directly on the object returned by `client.subscribe()`:
          //
          //     var subscription = client.subscribe(destination, onmessage);
          //     ...
          //     subscription.unsubscribe(headers);

      }, {
          key: 'unsubscribe',
          value: function unsubscribe(id) {
              var headers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

              var hdrs = Object.assign({}, headers);
              delete this.subscriptions[id];
              hdrs.id = id;
              this._transmit('UNSUBSCRIBE', hdrs);
          }

          // Clean up client resources when it is disconnected or the server did not
          // send heart beats in a timely fashion

      }, {
          key: '_cleanUp',
          value: function _cleanUp() {
              this.connected = false;
              clearInterval(this.pinger);
              clearInterval(this.ponger);
          }

          // Base method to transmit any stomp frame

      }, {
          key: '_transmit',
          value: function _transmit(command, headers, body) {
              var out = Frame.marshall(command, headers, body);
              this.debug('>>> ' + out, { frame: { command: command, headers: headers, body: body } });
              this._wsSend(out);
          }
      }, {
          key: '_wsSend',
          value: function _wsSend(data) {
              if (this.isBinary) data = unicodeStringToTypedArray(data);
              this.debug('>>> length ' + data.length);
              // if necessary, split the *STOMP* frame to send it on many smaller
              // *WebSocket* frames
              while (true) {
                  if (data.length > this.maxWebSocketFrameSize) {
                      this.ws.send(data.slice(0, this.maxWebSocketFrameSize));
                      data = data.slice(this.maxWebSocketFrameSize);
                      this.debug('remaining = ' + data.length);
                  } else {
                      return this.ws.send(data);
                  }
              }
          }

          // Heart-beat negotiation

      }, {
          key: '_setupHeartbeat',
          value: function _setupHeartbeat(headers) {
              var _this2 = this;

              if (this.version !== VERSIONS.V1_1 && this.version !== VERSIONS.V1_2) return;

              // heart-beat header received from the server looks like:
              //
              //     heart-beat: sx, sy

              var _split$map = (headers['heart-beat'] || '0,0').split(',').map(function (v) {
                  return parseInt(v, 10);
              }),
                  _split$map2 = slicedToArray(_split$map, 2),
                  serverOutgoing = _split$map2[0],
                  serverIncoming = _split$map2[1];

              if (!(this.heartbeat.outgoing === 0 || serverIncoming === 0)) {
                  var ttl = Math.max(this.heartbeat.outgoing, serverIncoming);
                  this.debug('send PING every ' + ttl + 'ms');
                  this.pinger = setInterval(function () {
                      _this2._wsSend(BYTES.LF);
                      _this2.debug('>>> PING');
                  }, ttl);
              }

              if (!(this.heartbeat.incoming === 0 || serverOutgoing === 0)) {
                  var _ttl = Math.max(this.heartbeat.incoming, serverOutgoing);
                  this.debug('check PONG every ' + _ttl + 'ms');
                  this.ponger = setInterval(function () {
                      var delta = Date.now() - _this2.serverActivity;
                      // We wait twice the TTL to be flexible on window's setInterval calls
                      if (delta > _ttl * 2) {
                          _this2.debug('did not receive server activity for the last ' + delta + 'ms');
                          _this2.ws.close();
                      }
                  }, _ttl);
              }
          }

          // parse the arguments number and type to find the headers, connectCallback and
          // (eventually undefined) errorCallback

      }, {
          key: '_parseConnect',
          value: function _parseConnect() {
              var headers = {},
                  connectCallback = void 0,
                  errorCallback = void 0;

              for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                  args[_key] = arguments[_key];
              }

              switch (args.length) {
                  case 2:
                      headers = args[0];
                      connectCallback = args[1];

                      break;
                  case 3:
                      if (args[1] instanceof Function) {
                          headers = args[0];
                          connectCallback = args[1];
                          errorCallback = args[2];
                      } else {
                          headers.login = args[0];
                          headers.passcode = args[1];
                          connectCallback = args[2];
                      }
                      break;
                  case 4:
                      headers.login = args[0];
                      headers.passcode = args[1];
                      connectCallback = args[2];
                      errorCallback = args[3];

                      break;
                  default:
                      headers.login = args[0];
                      headers.passcode = args[1];
                      connectCallback = args[2];
                      errorCallback = args[3];
                      headers.host = args[4];

              }

              return [headers, connectCallback, errorCallback];
          }
      }]);
      return Client;
  }();

  // The `webstomp` Object
  var webstomp = {
      Frame: Frame,
      VERSIONS: VERSIONS,
      // This method creates a WebSocket client that is connected to
      // the STOMP server located at the url.
      client: function client(url) {
          var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

          var ws = new WebSocket(url, options.protocols || VERSIONS.supportedProtocols());
          return new Client(ws, options);
      },

      // This method is an alternative to `webstomp.client()` to let the user
      // specify the WebSocket to use (either a standard HTML5 WebSocket or
      // a similar object).
      over: function over() {
          for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
          }

          return new (Function.prototype.bind.apply(Client, [null].concat(args)))();
      }
  };

  return webstomp;

})));
