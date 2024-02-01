import {onExtensionStart} from 'webext-events';
import progressivelyInjectScript from './inject.js';

if (globalThis.chrome && !navigator.userAgent.includes('Firefox')) {
	onExtensionStart.addListener(() => {
		const {content_scripts: scripts} = chrome.runtime.getManifest();

		if (!scripts?.length) {
			throw new Error('webext-inject-on-install tried to inject content scripts, but no content scripts were found in the manifest.');
		}

		console.debug('webext-inject-on-install: Found', scripts.length, 'content script(s) in the manifest.');

		for (const contentScript of scripts) {
			void progressivelyInjectScript(contentScript);
		}
	});
}
