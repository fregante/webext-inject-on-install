import chrome from 'sinon-chrome';

globalThis.chrome = chrome;

console.log();
chrome.runtime.getManifest.resolves({background: {persistent: true}, permissions: ['tabs']});
