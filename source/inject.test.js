
import {
	expect, test, beforeEach, vi,
} from 'vitest';
import {chrome} from 'vitest-chrome';
import {injectOneScript} from './inject.js';
import manifest from './demo/manifest.json' with {type: 'json'};

beforeEach(() => {
	vi.clearAllMocks();
	chrome.runtime.getManifest.mockReturnValue(manifest);
	chrome.storage.session.get.mockResolvedValue({});
});

test('base usage', async () => {
	const contentScript = manifest.content_scripts[0];
	const scriptableTabs = [
		{
			url: 'https://example.com/', discarded: false, id: 1, active: true,
		},
	];

	chrome.tabs.query.mockImplementation(async () => scriptableTabs);

	await injectOneScript(contentScript);
	expect(chrome.tabs.executeScript.mock.lastCall[1]).toMatchSnapshot();
	expect(chrome.tabs.insertCSS.mock.calls.length).toBe(0);
	expect(chrome.tabs.onUpdated.hasListeners()).toBe(false);
	expect(chrome.tabs.onUpdated.hasListeners()).toBe(false);
	expect(chrome.tabs.onRemoved.hasListeners()).toBe(false);
	expect(chrome.tabs.onActivated.hasListeners()).toBe(false);
});

test('css content', async () => {
	const contentScript = manifest.content_scripts[1];
	const scriptableTabs = [
		{
			id: 1,
			url: 'https://ephiframe.vercel.app/',
			discarded: false,
			active: true,
		},
	];

	chrome.tabs.query.mockImplementation(async () => scriptableTabs);

	await injectOneScript(contentScript);
	expect(chrome.tabs.executeScript.mock.calls.length).toBe(0);
	expect(chrome.tabs.insertCSS.mock.lastCall[1]).toMatchSnapshot();
});

test('deferred usage', async () => {
	const contentScript = manifest.content_scripts[0];
	const scriptableTabs = Array.from({length: 11}).fill(0).map((_, id) => ({
		id,
		url: `https://ephiframe.vercel.app/${id}`,
		discarded: false,
		active: false,
	}));

	chrome.tabs.query.mockImplementation(async () => scriptableTabs);

	await injectOneScript(contentScript);

	// Ensure no injections were made because no matching tabs were found
	expect(chrome.tabs.executeScript.mock.calls.length).toBe(0);
	expect(chrome.tabs.insertCSS.mock.calls.length).toBe(0);
	expect(chrome.tabs.onUpdated.hasListeners()).toBe(true);
	expect(chrome.tabs.onRemoved.hasListeners()).toBe(true);
	expect(chrome.tabs.onActivated.hasListeners()).toBe(true);

	// Ensure that the tracked list of tabs is updated when they're closed
	expect(chrome.storage.session.remove.mock.calls.length).toBe(0);
	chrome.tabs.onRemoved.callListeners(1);
	expect(chrome.storage.session.remove.mock.calls.length).toBe(1);
	chrome.tabs.onRemoved.callListeners(2);
	expect(chrome.storage.session.remove.mock.calls.length).toBe(2);
	expect(chrome.storage.session.remove.mock.calls).toMatchSnapshot();

	// Ensure that the tracked list of tabs is updated when they're discarded
	chrome.tabs.onUpdated.callListeners(3, {discarded: true});
	expect(chrome.storage.session.remove.mock.calls.length).toBe(3);
	chrome.tabs.onUpdated.callListeners(4, {discarded: true});
	expect(chrome.storage.session.remove.mock.calls.length).toBe(4);

	// Ensure that the tracked list of tabs is updated when they're activated and that they're injected
	chrome.storage.session.get.mockResolvedValue({'webext-inject-on-install:5': true});
	chrome.tabs.get.mockResolvedValue({url: 'https://ephiframe.vercel.app/5', id: 5, active: true});
	chrome.tabs.onActivated.callListeners({tabId: 5});

	// TODO: Mocking library is incomplete, not worth continuing
	// await Promise.resolve();
	// expect(chrome.storage.session.remove.mock.calls.length).toBe(5);
	// expect(chrome.tabs.executeScript.mock.calls.length).toBe(2);
	// expect(chrome.tabs.insertCSS.mock.calls.length).toBe(1);
	// expect(chrome.tabs.executeScript.mock.calls).toMatchSnapshot();
	// expect(chrome.tabs.insertCSS.mock.calls).toMatchSnapshot();

	// // Ensure that navigation away removes the tab without injecting the script
	// chrome.webNavigation.onCommitted.callListeners({tabId: 6, frameId: 2});
	// expect(chrome.storage.session.remove.mock.calls.length).toBe(6);
	// chrome.webNavigation.onCommitted.callListeners({tabId: 6, frameId: 0});
	// expect(chrome.storage.session.remove.mock.calls.length).toBe(5);
	// expect(chrome.tabs.executeScript.mock.calls.length).toBe(2);

	// // Ensure that the listeners are removed once the list is empty
	// expect(chrome.tabs.onUpdated.removeListener.mock.calls.length).toBe(0);
	// chrome.tabs.onRemoved.callListeners(7);
	// chrome.tabs.onRemoved.callListeners(8);
	// chrome.tabs.onRemoved.callListeners(9);
	// chrome.tabs.onRemoved.callListeners(10);
	// chrome.tabs.onRemoved.callListeners(11);
	// expect(chrome.tabs.onUpdated.removeListener.mock.calls.length).toBe(0);
	// chrome.tabs.onRemoved.callListeners(0);

	// expect(chrome.tabs.onUpdated.removeListener.mock.calls.length).toBe(1);
});
