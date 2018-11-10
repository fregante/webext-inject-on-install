# webext-inject-on-install

> Automatically add content scripts to existing tabs when your extension is installed. Chrome + Firefox

[![Travis build status](https://api.travis-ci.org/bfred-it/webext-inject-on-install.svg?branch=master)](https://travis-ci.org/bfred-it/webext-inject-on-install)
[![npm version](https://img.shields.io/npm/v/webext-inject-on-install.svg)](https://www.npmjs.com/package/webext-inject-on-install) 

Firefox actually already does this natively, so this module is automatically disabled there.

## Install

```sh
npm install --save webext-inject-on-install
```

## Usage

This script automatically picks up whatever is specified in `content_scripts`. 

Include `index.js` directly in manifest.json as a background script, for example:

```json
{
    "background": {
        "scripts": [
            "node_modules/webext-inject-on-install/index.js"
        ]
    }
}
```

Alternatively, if you use rollup (suggested) or browserify:

```js
require('webext-inject-on-install');
```

## Related

* [`Awesome WebExtensions`](https://github.com/bfred-it/Awesome-WebExtensions): A curated list of awesome resources for Web Extensions development

## License

MIT © [Federico Brigante](http://twitter.com/bfred_it)
