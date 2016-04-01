# 1.0.0 - 01 Apr. 2016

Initial fork from stomp.js

## Breaking changes

* `webstomp.client` second parameter is now an object containing `protocols`, `binary`, `heartbeat`. All are optionals.
* same for `webstomp.over`
* `client.send` parameters are now `destination, body, headers` instead of `destination, headers, body`. Easier to set `headers` optional.
* `onclose` error callback now receive the original event

## Improvement

* stomp 1.2 support
* binary support
* better unicode utf-8 support
* UMD compatible
* `client.unsubscribe()` can now take a second parameter `header` to be able to send specific header like `persistent: true`
* as a consequence `subscription.unsubscribe` can now take a `header` parameter.
