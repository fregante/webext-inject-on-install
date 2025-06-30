import {injectContentScript, isScriptableUrl} from 'webext-content-scripts';
import {doesUrlMatchPatterns} from 'webext-patterns';
import {
	addTabsToWaitingList,
	getTabsWaitingForInjection,
	ignoredTabs,
	isTabWaitingForInjection,
	removeTabFromWaitingList,
} from './storage.js';

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

async function forgetTab(tabId: number) {
	await removeTabFromWaitingList(tabId);
	await removeListenersIfDone();
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
	if (await isTabWaitingForInjection(tabId)) {
		await injectRegisteredScripts(tabId);
	}
}

function addListeners() {
	chrome.tabs.onRemoved.addListener(forgetTab);
	chrome.tabs.onUpdated.addListener(onUpdated);
	chrome.tabs.onActivated.addListener(onActivated);
	chrome.webNavigation?.onCommitted.addListener(onCommitted);
}

async function removeListenersIfDone() {
	const tracked = await getTabsWaitingForInjection();
	if (tracked.length === 0) {
		console.debug('webext-inject-on-install: no tabs remaining. Unloading');
		chrome.tabs.onRemoved.removeListener(forgetTab);
		chrome.tabs.onUpdated.removeListener(onUpdated);
		chrome.tabs.onActivated.removeListener(onActivated);
		chrome.webNavigation?.onCommitted.removeListener(onCommitted);
	} else {
		console.debug('webext-inject-on-install:', tracked, 'tabs remaining');
	}
}

async function injectRegisteredScripts(tabId: number) {
	if (ignoredTabs.has(tabId)) {
		// Last-moment check to avoid race conditions
		return;
	}

	void forgetTab(tabId);

	const {url} = await chrome.tabs.get(tabId);
	if (!url) {
		return;
	}

	const scripts = chrome.runtime.getManifest().content_scripts!;
	console.group('webext-inject-on-install: deferred injections for', tabId);
	const promises = scripts.map(async script => {
		if (script.matches && doesUrlMatchPatterns(url, ...script.matches)) {
			console.debug(script);
			await injectAndDiscardCertainErrors(tabId, script);
		}
	});

	console.groupEnd();

	// Await after group so that all logs are grouped
	await Promise.allSettled(promises);
}

export async function registerOneScript(contentScript: ContentScript) {
	const tabs = await chrome.tabs.query({
		url: contentScript.matches,
		discarded: false,

		// Excludes unloaded tabs https://github.com/fregante/webext-inject-on-install/issues/11
		status: 'complete',
	});

	console.group('webext-inject-on-install');
	console.debug(contentScript);

	const foregroundTabs: number[] = [];
	const backgroundTabs: number[] = [];
	for (const tab of tabs) {
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
		addListeners();
		void addTabsToWaitingList(backgroundTabs);
	}

	// Warning: If there's any `await` before this, the grouping will be broken
	console.groupEnd();
}

export default async function registerScripts(contentScripts: ContentScript[]) {
	await Promise.allSettled(contentScripts.map(async script => registerOneScript(script)));
}
