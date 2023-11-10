import {injectContentScript, isScriptableUrl} from 'webext-content-scripts';

const acceptableInjectionsCount = 10;

/** Loop an iterable with the ability to place `await` in the loop itself */
async function asyncForEach<Item>(
	iterable: Iterable<Item>,
	iteratee: (item: Item) => Promise<void>,
): Promise<void> {
	await Promise.all([...iterable].map(async x => iteratee(x)));
}

const tracked = new Set<number>();

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
	if (tracked.has(tabId)) {
		forgetTab(tabId);
		void injectContentScript(
			tabId,
			chrome.runtime.getManifest().content_scripts!,
		);
	}
}

const background = globalThis.chrome?.runtime.getManifest().background;
const isPersistentBackgroundPage = background && !('service_worker' in background) && background.persistent !== false;

async function init() {
	chrome.tabs.onUpdated.addListener(onDiscarded);
	chrome.tabs.onRemoved.addListener(forgetTab);
	chrome.tabs.onActivated.addListener(onActivated);

	const {content_scripts: scripts} = chrome.runtime.getManifest();

	if (!scripts?.length) {
		throw new Error('webext-inject-on-install tried to inject content scripts, but no content scripts were found in the manifest.');
	}

	await asyncForEach(scripts, async contentScript => {
		const liveTabs = await chrome.tabs.query({url: contentScript.matches, discarded: false});
		const scriptableTabs = liveTabs.filter(tab => isScriptableUrl(tab.url));
		// TODO: MV3 support via chrome.storage.session https://github.com/fregante/webext-dynamic-content-scripts/issues/4
		const singleInjection = !isPersistentBackgroundPage || scriptableTabs.length <= acceptableInjectionsCount;

		for (const tab of scriptableTabs) {
			if (singleInjection || tab.active) {
				void injectContentScript(
					tab.id!,
					contentScript,
				);
			} else {
				tracked.add(tab.id!);
			}
		}
	});
}

if (globalThis.chrome) {
	// eslint-disable-next-line unicorn/prefer-top-level-await -- Single-file, it's better to keep an `init` function
	void init();
}
