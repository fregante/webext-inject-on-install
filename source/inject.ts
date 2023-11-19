import {injectContentScript, isScriptableUrl} from 'webext-content-scripts';
import chromeP from 'webext-polyfill-kinda';

const acceptableInjectionsCount = 10;

type ContentScript = NonNullable<chrome.runtime.Manifest['content_scripts']>[number];

export const tracked = new Map<number, ContentScript[]>();

function forgetTab(tabId: number) {
	tracked.delete(tabId);
	if (tracked.size === 0) {
		chrome.tabs.onUpdated.removeListener(onDiscarded);
		chrome.tabs.onRemoved.removeListener(forgetTab);
		chrome.tabs.onActivated.removeListener(onActivated);
	}
}

function onDiscarded(tabId: number, changeInfo: {discarded?: boolean}) {
	if (changeInfo.discarded) {
		forgetTab(tabId);
	}
}

function onActivated({tabId}: {tabId: number}) {
	const scripts = tracked.get(tabId);
	if (!scripts) {
		return;
	}

	forgetTab(tabId);
	console.debug('webext-inject-on-install: Deferred injecting', scripts, 'into tab', tabId);
	for (const script of scripts) {
		void injectContentScript(tabId, script);
	}
}

const background = globalThis.chrome?.runtime.getManifest().background;
const isPersistentBackgroundPage = background && !('service_worker' in background) && background.persistent !== false;

export default async function progressivelyInjectScript(contentScript: ContentScript) {
	const liveTabs = await chromeP.tabs.query({url: contentScript.matches, discarded: false});
	const scriptableTabs = liveTabs.filter(tab => isScriptableUrl(tab.url));
	console.debug('webext-inject-on-install: Found', liveTabs.length, 'tabs matching', contentScript);
	// TODO: Non-persistent pages support via chrome.storage.session https://github.com/fregante/webext-dynamic-content-scripts/issues/1
	const singleInjection = !isPersistentBackgroundPage || scriptableTabs.length <= acceptableInjectionsCount;
	console.debug('webext-inject-on-install: Single injection?', singleInjection);

	for (const tab of scriptableTabs) {
		if (singleInjection || tab.active) {
			console.debug('webext-inject-on-install: Injecting', contentScript, 'into tab', tab.id);
			void injectContentScript(
				// Unless https://github.com/fregante/webext-content-scripts/issues/30 is changed
				contentScript.all_frames ? tab.id! : {tabId: tab.id!, frameId: 0},
				contentScript,
			);
		} else {
			chrome.tabs.onUpdated.addListener(onDiscarded);
			chrome.tabs.onRemoved.addListener(forgetTab);
			chrome.tabs.onActivated.addListener(onActivated);
			const scripts = tracked.get(tab.id!) ?? [];
			scripts.push(contentScript);
			tracked.set(tab.id!, scripts);
		}
	}
}
