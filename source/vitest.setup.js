import {vi} from 'vitest';
import {chrome} from 'vitest-chrome';

globalThis.chrome = chrome;

chrome.storage.session = chrome.storage.local;
chrome.storage.session.getKeys = vi.fn(() => []);
