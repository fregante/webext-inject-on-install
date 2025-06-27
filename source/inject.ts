import {injectContentScript, isScriptableUrl} from 'webext-content-scripts';
import {doesUrlMatchPatterns} from 'webext-patterns';

const errorEnterprisePolicy = 'This page cannot be scripted due to an ExtensionsSettings policy.';

type ContentScript = NonNullable<chrome.runtime.Manifest['content_scripts']>[number];

const injectAndDiscardCertainErrors: typeof injectContentScript = async (tabId, contentScript) => {
	try {
		await injectContentScript(tabId, contentScript);
	} catch (error) {
		if (error instanceof Error && error.message === errorEnterprisePolicy) {
			console.debug('webext-inject-on-install: Enteprise policy blocked access to tab', tabId, error);
		} else {
			throw error;
		}
	}
};

const storageKeyRoot = 'webext-inject-on-install:';

function getTabStorageKey(tabId: number) {
	return `${storageKeyRoot}${tabId}`;
}

async function forgetTab(tabId: number) {
	await chrome.storage.session.remove(getTabStorageKey(tabId));
	const fullStorage = await chrome.storage.session.getKeys();
	const tracked = fullStorage.filter(key => key.startsWith(storageKeyRoot)).length;
	if (tracked === 0) {
		console.debug('webext-inject-on-install: no tabs remaining. Unloading');
		chrome.tabs.onRemoved.removeListener(forgetTab);
		chrome.tabs.onUpdated.removeListener(onUpdated);
		chrome.tabs.onActivated.removeListener(onActivated);
		chrome.webNavigation?.onCommitted.removeListener(onCommitted);
	} else {
		console.debug('webext-inject-on-install:', tracked, 'tabs remaining');
	}
}

function onUpdated(tabId: number, changeInfo: {discarded?: boolean}) {
	if (changeInfo.discarded) {
		void forgetTab(tabId);
	}
}

function onCommitted({tabId, frameId}: {tabId: number; frameId: number}) {
	if (frameId === 0) {
		void forgetTab(tabId);
	}
}

async function onActivated({tabId}: {tabId: number}) {
	const key = getTabStorageKey(tabId);
	const storage = await chrome.storage.session.get(key);

	if (!storage[key]) {
		return;
	}

	await forgetTab(tabId);

	const tab = await chrome.tabs.get(tabId);
	const scripts = chrome.runtime.getManifest().content_scripts!;
	console.group('webext-inject-on-install: deferred injections for', tabId);
	for (const script of scripts) {
		if (tab.url && script.matches && doesUrlMatchPatterns(tab.url, ...script.matches)) {
			console.debug(script);
			void injectAndDiscardCertainErrors(tabId, script);
		}
	}

	console.groupEnd();
}

export async function injectOneScript(contentScript: ContentScript) {
	const liveTabs = await chrome.tabs.query({
		url: contentScript.matches,
		discarded: false,

		// Excludes unloaded tabs https://github.com/fregante/webext-inject-on-install/issues/11
		status: 'complete',
	});

	console.group('webext-inject-on-install');
	console.debug(contentScript);

	const foregroundTabs: number[] = [];
	const backgroundTabs: number[] = [];
	for (const tab of liveTabs) {
		if (!tab.id || !isScriptableUrl(tab.url)) {
			continue;
		}

		if (tab.active) {
			foregroundTabs.push(tab.id);
		} else {
			backgroundTabs.push(tab.id);
		}
	}

	if (foregroundTabs.length + backgroundTabs.length === 0) {
		console.debug('No matching tabs', contentScript);
		console.groupEnd();
		return;
	}

	for (const tabId of foregroundTabs) {
		console.debug('Foreground tab injection:', tabId);
		void injectAndDiscardCertainErrors(
			contentScript.all_frames ? tabId : {tabId, frameId: 0},
			contentScript,
		);
	}

	if (backgroundTabs.length > 0) {
		console.debug('Background tabs:', ...backgroundTabs);
		// Register listeners
		chrome.tabs.onRemoved.addListener(forgetTab);
		chrome.tabs.onUpdated.addListener(onUpdated);
		chrome.tabs.onActivated.addListener(onActivated);
		chrome.webNavigation?.onCommitted.addListener(onCommitted);

		// Keep track of them
		const entries = backgroundTabs.map(tabId => [getTabStorageKey(tabId), true] as const);
		void chrome.storage.session.set(Object.fromEntries(entries));
	}

	// Warning: If there's any `await` before this, the grouping will be broken
	console.groupEnd();
}

export default async function injectScripts(contentScripts: ContentScript[]) {
	await Promise.allSettled(contentScripts.map(async script => injectOneScript(script)));
}
