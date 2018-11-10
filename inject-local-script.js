export default function (fn) {
	const script = document.createElement(`script`);
	if (typeof fn === 'string') {
		script.src = chrome.runtime.getURL(fn);
	} else {
		script.textContent = fn.toString();
	}
	document.body.appendChild(script);
}

// http://stackoverflow.com/a/22293383/288906