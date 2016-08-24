// include this as a background script
// it will automatically load content_scripts/styles on all current tabs
// FIX: it will load them regardless of whether they've been previously loaded
(function enableAllCurrentTabs() {
	const showErrors = () => {
		if (chrome.runtime.lastError) {
			console.error(chrome.runtime.lastError);
		}
	};
	chrome.runtime.getManifest().content_scripts.forEach(script => {
		const loadContentScripts = tab => {
			(script.js || []).forEach(file => {
				chrome.tabs.executeScript(tab.id, {
					allFrames: script.all_frames,
					file
				}, showErrors);
			});
			(script.css || []).forEach(file => {
				chrome.tabs.insertCSS(tab.id, {
					allFrames: script.all_frames,
					file
				}, showErrors);
			});
		};
		chrome.tabs.query({
			url: script.matches
		}, tabs => {
			tabs.forEach(loadContentScripts);
		});
	});
})();
