import {injectContentScript, isScriptableUrl} from 'webext-content-scripts';
import chromeP from 'webext-polyfill-kinda';

const acceptableInjectionsCount = 10;

type ContentScript = NonNullable<chrome.runtime.Manifest['content_scripts']>[number];

/** Loop an iterable with the ability to place `await` in the loop itself */
async function asyncForEach<Item>(
	iterable: Iterable<Item>,
	iteratee: (item: Item) => Promise<void>,
): Promise<void> {
	await Promise.all([...iterable].map(async x => iteratee(x)));
}

const tracked = new Map<number, ContentScript[]>();

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
	console.debug('webext-inject-on-install: Injecting', scripts, 'into tab', tabId);
	for (const script of scripts) {
		void injectContentScript(tabId, script);
	}
}

const background = globalThis.chrome?.runtime.getManifest().background;
const isPersistentBackgroundPage = background && !('service_worker' in background) && background.persistent !== false;

async function init() {
	const {content_scripts: scripts} = chrome.runtime.getManifest();

	if (!scripts?.length) {
		throw new Error('webext-inject-on-install tried to inject content scripts, but no content scripts were found in the manifest.');
	}

	console.debug('webext-inject-on-install: Found', scripts.length, 'content script(s) in the manifest.');

	await asyncForEach(scripts, async contentScript => {
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
					tab.id!,
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
	});
}

if (globalThis.chrome && !navigator.userAgent.includes('Firefox')) {
	// eslint-disable-next-line unicorn/prefer-top-level-await -- Single-file, it's better to keep an `init` function
	void init();
}
