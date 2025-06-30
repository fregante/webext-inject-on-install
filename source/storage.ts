export async function getTabsWaitingForInjection(): Promise<number[]> {
	const fullStorage = await chrome.storage.session.getKeys();
	return fullStorage
		.filter(key => key.startsWith(storageKeyRoot))
		.map(key => Number(key.slice(storageKeyRoot.length)));
}

export const storageKeyRoot = 'webext-inject-on-install:';
export function getTabStorageKey(tabId: number) {
	return `${storageKeyRoot}${tabId}`;
}

export async function isTabWaitingForInjection(tabId: number) {
	const key = getTabStorageKey(tabId);
	const storage = await chrome.storage.session.get(key);
	return key in storage;
}

// Local synchronous optimization to avoid multiple requests for the same tab
export const ignoredTabs = new Set();

