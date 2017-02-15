# 1.0.6 - 15 Feb. 2016

* Fix missing TS definitions file in package.json


# 1.0.5 - 05 Feb. 2016

* Add TS definitions file
* Update all dependencies, especially webpack to 2.2


# 1.0.4 - 04 Aug. 2016

* Fixes default options value when an options object is already given with missing values


# 1.0.3 - 31 July 2016

* Add check to see if user has already included heart beat information in headers before adding default values (thanks @NathanGloyn)
* Replace jshint & jscs by eslint (thanks @yeyu456)
* Add *dist* folder to github so users without npm and ES6 support can fetch the lib


# 1.0.2 - 09 Apr. 2016

* Add an example using nodejs
* Update the documentation around nodejs and webstomp.over


# 1.0.1 - 06 Apr. 2016

* Fixes #2: better ES6 default options for Client
* Add an example using sockjs & webstomp.over


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
