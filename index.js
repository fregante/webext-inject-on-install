// include this as a background script
// it will automatically load content_scripts/styles on all current tabs
// FIX: it will load them regardless of whether they've been previously loaded

/**
 *
 * WIP SITUATION: have been working on the FIX above
 * Solution was: allow content.js to add onEject listeners
 * Problem is: content.js can't store functions between ext updates (context changes)
 * Solution is: inject onEject listeners into unsafeWindow scope
 * Problem is: WIP in inject-local-script.js to add support for variables (e.g. id) https://stackoverflow.com/questions/9515704/building-a-chrome-extension-inject-code-in-a-page-using-a-content-script
 */

const id = `webextInjectOnInstallFor${chrome.runtime.id}`;

// Add self-ejecting function.
// This also keeps track of onEject listeners
function setupEjector() {
	if (!window[id]) {
		window[id] = function () {
			console.log('lololol')
			window[id].listeners.forEach(listener => {
				listener();
			});
			delete window[id];
		};
		window[id].listeners = new Set();
	}
	return window[id].listeners;
}

function addEjectListener(listener) {
	console.log(id, window[id] && window[id].listeners)
	setupEjector().add(listener);
	console.log(id, window[id].listeners)
}

function enableAllCurrentTabs() {
	const showErrors = () => {
		if (chrome.runtime.lastError) {
			console.error(chrome.runtime.lastError);
		}
	};
	chrome.runtime.getManifest().content_scripts.forEach(script => {
		const allFrames = script.all_frames;
		const url = script.matches;
		const loadContentScripts = tab => {
			(script.js || []).forEach(file => {
				// run any onEject listeners
				chrome.tabs.executeScript(tab.id, {
					allFrames,
					code: `console.log('new injection', window.${id});window.${id} && ${id}();`
				}, showErrors);

				// load scripts
				chrome.tabs.executeScript(tab.id, {allFrames, file}, showErrors);
			});
			(script.css || []).forEach(file => {
				chrome.tabs.insertCSS(tab.id, {allFrames, file}, showErrors);
			});
		};
		chrome.tabs.query({url}, tabs => tabs.forEach(loadContentScripts));
	});
}

if (typeof exports === 'undefined') {
	enableAllCurrentTabs();
} else {
	exports.onEject = addEjectListener;
	exports.injectContentScripts = enableAllCurrentTabs;
}
