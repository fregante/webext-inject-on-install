/// <reference types="bun-types" />
/// <reference lib="dom" />
import {expect, test, beforeEach} from 'bun:test';
import chrome from 'sinon-chrome';
import progressivelyInjectScript from './inject.js';

beforeEach(() => {
	chrome.flush();
});

test('progressivelyInjectScript', async () => {
	const tabId = 1;
	const contentScript = {
		matches: ['https://example.com/*'],
		js: ['foo.js'],
		css: ['foo.css'],
	};
	const liveTabs = [{url: 'https://example.com/', discarded: false}];
	const scriptableTabs = [{url: 'https://example.com/', discarded: false, id: tabId}];
	const acceptableInjectionsCount = 1;

	chrome.tabs.query.withArgs({url: contentScript.matches, discarded: false}).yields(liveTabs);
	chrome.tabs.query.withArgs({url: contentScript.matches, discarded: false}).yields(scriptableTabs);
	chrome.runtime.getManifest.returns({background: {persistent: true}});
	chrome.tabs.executeScript.resolves([{}]);
	chrome.tabs.insertCSS.resolves();

	await progressivelyInjectScript(contentScript, acceptableInjectionsCount);
	expect(chrome.tabs.executeScript.callCount).toBe(1);
	expect(chrome.tabs.insertCSS.callCount).toBe(1);
	expect(chrome.tabs.onUpdated.addListener.callCount).toBe(0);
	expect(chrome.tabs.onRemoved.addListener.callCount).toBe(0);
	expect(chrome.tabs.onActivated.addListener.callCount).toBe(0);
});
