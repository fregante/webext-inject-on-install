import {vi} from 'vitest';
import {chrome} from 'vitest-chrome';

// eslint-disable-next-line unicorn/no-global-object-property-assignment -- Test setup
globalThis.chrome = chrome;

chrome.storage.session = chrome.storage.local;
chrome.storage.session.getKeys = vi.fn(() => []);
