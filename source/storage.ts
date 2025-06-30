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
	if (ignoredTabs.has(tabId)) {
		return false;
	}

	const key = getTabStorageKey(tabId);
	const storage = await chrome.storage.session.get(key);
	return key in storage;
}

// Local synchronous optimization to avoid multiple requests for the same tab
export const ignoredTabs = new Set();

export async function removeTabFromWaitingList(tabId: number) {
	ignoredTabs.add(tabId);
	await chrome.storage.session.remove(getTabStorageKey(tabId));
}

export async function addTabsToWaitingList(tabIds: number[]) {
	const entries = tabIds.map(tabId => [getTabStorageKey(tabId), true] as const);
	await chrome.storage.session.set(Object.fromEntries(entries));
}
