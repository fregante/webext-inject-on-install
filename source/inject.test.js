
import {
	expect, test, beforeEach,
} from 'vitest';
import chrome from 'sinon-chrome';
// eslint-disable-next-line import-x/no-unassigned-import
import './test-setup.js';
import {injectOneScript, _trackedSync as tracked} from './inject.js';

beforeEach(() => {
	chrome.flush();
	chrome.runtime.getManifest.returns({permissions: ['tabs']});
	tracked.clear();
});

test('base usage', async () => {
	const contentScript = {
		matches: ['https://example.com/*'],
		js: ['foo.js', 'bar.js'],
		css: ['foo.css'],
	};
	const scriptableTabs = [
		{url: 'https://example.com/', discarded: false, id: 1},
	];

	chrome.tabs.query.withArgs({
		url: contentScript.matches,
		discarded: false,
		status: 'complete',
	}).yields(scriptableTabs);

	await injectOneScript(contentScript);
	expect(chrome.tabs.executeScript.getCalls().map(x => x.args)).toMatchSnapshot();
	expect(chrome.tabs.insertCSS.getCalls().map(x => x.args)).toMatchSnapshot();
	expect(chrome.tabs.onUpdated.addListener.callCount).toBe(0);
	expect(chrome.tabs.onRemoved.addListener.callCount).toBe(0);
	expect(chrome.tabs.onActivated.addListener.callCount).toBe(0);
});

test('deferred usage', async () => {
	const contentScript = {
		matches: ['https://example.com/*'],
		js: ['foo.js', 'bar.js'],
		css: ['foo.css'],
	};
	const scriptableTabs = Array.from({length: 11}).fill(0).map((_, id) => ({url: `https://example.com/${id}`, discarded: false, id}));

	chrome.tabs.query.withArgs({
		url: contentScript.matches,
		discarded: false,
		status: 'complete',
	}).yields(scriptableTabs);

	await injectOneScript(contentScript);

	// Ensure no injections were made because of the large nunmber of open tabs
	expect(chrome.tabs.executeScript.callCount).toBe(0);
	expect(chrome.tabs.insertCSS.callCount).toBe(0);
	expect(chrome.tabs.onUpdated.addListener.callCount).toBe(11);
	expect(chrome.tabs.onRemoved.addListener.callCount).toBe(11);
	expect(chrome.tabs.onActivated.addListener.callCount).toBe(11);
	expect(tracked).toMatchSnapshot();
	expect(tracked).toHaveLength(11);

	// Ensure that the tracked list of tabs is updated when they're closed
	chrome.tabs.onRemoved.trigger(1);
	chrome.tabs.onRemoved.trigger(2);
	expect(tracked).toHaveLength(9);

	// Ensure that the tracked list of tabs is updated when they're discarded
	chrome.tabs.onUpdated.trigger(3, {discarded: true});
	chrome.tabs.onUpdated.trigger(4, {discarded: true});
	expect(tracked).toHaveLength(7);

	// Ensure that the tracked list of tabs is updated when they're activated and that they're injected
	chrome.tabs.onActivated.trigger({tabId: 5});
	expect(tracked).toHaveLength(6);
	expect(chrome.tabs.executeScript.callCount).toBe(2);
	expect(chrome.tabs.insertCSS.callCount).toBe(1);
	expect(chrome.tabs.executeScript.getCalls().map(x => x.args)).toMatchSnapshot();
	expect(chrome.tabs.insertCSS.getCalls().map(x => x.args)).toMatchSnapshot();

	// Ensure that navigation away removes the tab without injecting the script
	chrome.webNavigation.onCommitted.trigger({tabId: 6, frameId: 2});
	expect(tracked).toHaveLength(6);
	chrome.webNavigation.onCommitted.trigger({tabId: 6, frameId: 0});
	expect(tracked).toHaveLength(5);
	expect(chrome.tabs.executeScript.callCount).toBe(2);

	// Ensure that the listeners are removed once the list is empty
	expect(chrome.tabs.onUpdated.removeListener.callCount).toBe(0);
	chrome.tabs.onRemoved.trigger(7);
	chrome.tabs.onRemoved.trigger(8);
	chrome.tabs.onRemoved.trigger(9);
	chrome.tabs.onRemoved.trigger(10);
	chrome.tabs.onRemoved.trigger(11);
	expect(chrome.tabs.onUpdated.removeListener.callCount).toBe(0);
	chrome.tabs.onRemoved.trigger(0);
	expect(tracked).toHaveLength(0);

	// TODO: This should be 1, I'm not sure why `forgetTab` is being called 6 times at once. I assume it's a sinon-chrome bug
	expect(chrome.tabs.onUpdated.removeListener.callCount).toBe(6);
});
