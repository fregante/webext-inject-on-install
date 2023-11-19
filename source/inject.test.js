/// <reference types="bun-types" />
/// <reference lib="dom" />
import {expect, test, beforeEach} from 'bun:test';
import chrome from 'sinon-chrome';
import progressivelyInjectScript, {tracked} from './inject.js';

beforeEach(() => {
	chrome.flush();
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

	chrome.tabs.query.withArgs({url: contentScript.matches, discarded: false}).yields(scriptableTabs);

	await progressivelyInjectScript(contentScript);
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
	const scriptableTabs = Array.from({length: 11}).fill(0).map((_, i) => ({url: `https://example.com/${i}`, discarded: false, id: i}));

	chrome.tabs.query.withArgs({url: contentScript.matches, discarded: false}).yields(scriptableTabs);

	await progressivelyInjectScript(contentScript);

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
});
