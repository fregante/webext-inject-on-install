import {injectContentScript, isScriptableUrl} from 'webext-content-scripts';
import {isPersistentBackgroundPage} from 'webext-detect';
import chromeP from 'webext-polyfill-kinda';

const acceptableInjectionsCount = 10;

const errorEnterprisePolicy = 'This page cannot be scripted due to an ExtensionsSettings policy.';

type ContentScript = NonNullable<chrome.runtime.Manifest['content_scripts']>[number];

export const tracked = new Map<number, ContentScript[]>();

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

function forgetTab(tabId: number) {
	tracked.delete(tabId);
	if (tracked.size === 0) {
		chrome.tabs.onUpdated.removeListener(onDiscarded);
		chrome.tabs.onRemoved.removeListener(forgetTab);
		chrome.tabs.onActivated.removeListener(onActivated);
		chrome.webNavigation?.onCommitted.removeListener(onCommitted);
	}
}

function onDiscarded(tabId: number, changeInfo: {discarded?: boolean}) {
	if (changeInfo.discarded) {
		forgetTab(tabId);
	}
}

function onCommitted({tabId, frameId}: {tabId: number; frameId: number}) {
	if (frameId === 0) {
		forgetTab(tabId);
	}
}

function onActivated({tabId}: {tabId: number}) {
	const scripts = tracked.get(tabId);
	if (!scripts) {
		return;
	}

	forgetTab(tabId);
	console.debug('webext-inject-on-install: Deferred injection', scripts, 'into tab', tabId);
	for (const script of scripts) {
		void injectAndDiscardCertainErrors(tabId, script);
	}
}

export default async function progressivelyInjectScript(contentScript: ContentScript) {
	const permissions = globalThis.chrome?.runtime.getManifest().permissions;
	if (!permissions?.includes('tabs')) {
		throw new Error('webext-inject-on-install: The "tabs" permission is required');
	}

	const liveTabs = await chromeP.tabs.query({
		url: contentScript.matches,
		discarded: false,

		// Excludes unloaded tabs https://github.com/fregante/webext-inject-on-install/issues/11
		status: 'complete',
	});

	// `tab.url` is empty when the browser is starting, which is convenient because we don't need to inject anything.
	const scriptableTabs = liveTabs.filter(tab => isScriptableUrl(tab.url));
	console.debug('webext-inject-on-install: Found', scriptableTabs.length, 'tabs matching', contentScript);

	if (scriptableTabs.length === 0) {
		return;
	}

	// TODO: Non-persistent pages support via chrome.storage.session
	// https://github.com/fregante/webext-inject-on-install/issues/4
	const singleInjection = !isPersistentBackgroundPage() || scriptableTabs.length <= acceptableInjectionsCount;
	console.debug('webext-inject-on-install: Single injection?', singleInjection);

	for (const tab of scriptableTabs) {
		if (singleInjection || tab.active) {
			console.debug('webext-inject-on-install: Injecting', contentScript, 'into tab', tab.id);
			void injectAndDiscardCertainErrors(
				// Unless https://github.com/fregante/webext-content-scripts/issues/30 is changed
				contentScript.all_frames ? tab.id! : {tabId: tab.id!, frameId: 0},
				contentScript,
			);
		} else {
			chrome.tabs.onUpdated.addListener(onDiscarded);
			chrome.tabs.onRemoved.addListener(forgetTab);
			chrome.tabs.onActivated.addListener(onActivated);

			// Catch tab navigations that happen while the tab is not active
			chrome.webNavigation?.onCommitted.addListener(onCommitted);

			const scripts = tracked.get(tab.id!) ?? [];
			scripts.push(contentScript);

			tracked.set(tab.id!, scripts);
		}
	}
}
