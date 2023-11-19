import chrome from 'sinon-chrome';

globalThis.chrome = chrome;

chrome.runtime.getManifest.returns({background: {persistent: true}, permissions: ['tabs']});
