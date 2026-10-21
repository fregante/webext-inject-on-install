import {onExtensionStart} from 'webext-events';
import registerScripts from './inject.js';

async function register() {
	const {content_scripts: scripts} = chrome.runtime.getManifest();

	console.debug('webext-inject-on-install: Found', scripts!.length, 'content script(s) in the manifest.');

	await registerScripts(scripts!);
}

if (globalThis.chrome !== undefined && navigator.userAgent.includes('Chrome')) {
	const manifest = chrome.runtime.getManifest() as chrome.runtime.ManifestV3;

	if ((manifest.content_scripts?.length ?? 0) === 0) {
		throw new Error('webext-inject-on-install tried to inject content scripts, but no content scripts were found in the manifest');
	}

	if (chrome.storage?.session === undefined || chrome.scripting === undefined) {
		throw new Error('webext-inject-on-install requires the "storage" and "scripting" permissions');
	}

	if ((manifest.host_permissions?.length ?? 0) === 0 && !manifest.permissions?.includes('tabs')) {
		throw new Error('webext-inject-on-install requires either the "tabs" permission or some hosts in "host_permissions"');
	}

	onExtensionStart.addListener(register);
	chrome.runtime.onStartup.addListener(() => {
		onExtensionStart.removeListener(register);
	});
}
