// include this as a background script
// it will automatically load content_scripts/styles on all current tabs
// FIX: it will load them regardless of whether they've been previously loaded
(function enableAllCurrentTabs() {
	const showErrors = () => {
		if (chrome.runtime.lastError) {
			console.error(chrome.runtime.lastError);
		}
	};
	// Disable on Firefox, it already behaves this way
	if (navigator.vendor.indexOf('Google') < 0) {
		return;
	}
	chrome.runtime.getManifest().content_scripts.forEach(script => {
		const allFrames = script.all_frames;
		const url = script.matches;
		const loadContentScripts = tab => {
			(script.js || []).forEach(file => {
				chrome.tabs.executeScript(tab.id, {allFrames, file}, showErrors);
			});
			(script.css || []).forEach(file => {
				chrome.tabs.insertCSS(tab.id, {allFrames, file}, showErrors);
			});
		};
		chrome.tabs.query({url}, tabs => tabs.forEach(loadContentScripts));
	});
})();
