# webext-inject-on-install

<!-- [![][badge-gzip]][link-bundlephobia] Disabled until https://github.com/pastelsky/bundlephobia/issues/379 -->

[badge-gzip]: https://img.shields.io/bundlephobia/minzip/webext-inject-on-install.svg?label=gzipped
[link-bundlephobia]: https://bundlephobia.com/result?p=webext-inject-on-install

> Automatically add content scripts to existing tabs when your extension is installed.

Safari and Firefox actually already does this natively, so this module is automatically disabled there.

- Browsers: Chrome 130+
- Manifest: v3 (v2 was last supported in `webext-inject-on-install v2.3.0`)
- Permissions: `scripting`, `storage`, (`tabs` or `host_permissions` that includes all the hosts specified in `content_scripts`)
- Context: `background`

**Sponsored by [PixieBrix](https://www.pixiebrix.com)** :tada:

## Install

```sh
npm install webext-inject-on-install
```

Or download the [standalone bundle](https://bundle.fregante.com/?pkg=webext-inject-on-install) to include in your `manifest.json`.

## Usage

It registers automatically:

```js
import "webext-inject-on-install";
```

## How it works

1. It gets the list of content scripts from the manifest
2. For each content script group, it looks for open tabs that are not discarded (discarded tabs are already handled by the browser)
3. It injects the script into the tabs matching the `matches` patterns (`exclude_matches` is not supported https://github.com/fregante/webext-inject-on-install/issues/5)
4. If the tab count exceeds 10 (each), it injects into the tabs only when they become active. (persistent background pages only https://github.com/fregante/webext-inject-on-install/issues/4)

## Related

- [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts) - Automatically registers your `content_scripts` on domains added via `permission.request`
- [webext-content-scripts](https://github.com/fregante/webext-content-scripts) - Utility functions to inject content scripts in WebExtensions.
- [webext-options-sync](https://github.com/fregante/webext-options-sync) - Helps you manage and autosave your extension's options.
- [More…](https://github.com/fregante/webext-fun)

## License

MIT © [Federico Brigante](https://fregante.com)
