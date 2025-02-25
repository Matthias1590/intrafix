class Storage {
    static async get(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result[key]);
                }
            });
        });
    }

    static async set(key, value) {
        return new Promise((resolve, reject) => {
            const data = {};
            data[key] = value;
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }
}

async function setCache(url, baseUrl, html) {
	let cachedPages = await Storage.get("cachedPages");
	if (!cachedPages) {
		cachedPages = {};
	}

	cachedPages[url] = { isHtml: true, baseUrl, html };

	await Storage.set("cachedPages", cachedPages);
}

async function getCache(url) {
	const cachedPages = await Storage.get("cachedPages");
	return cachedPages ? cachedPages[url] : null;
}

async function setCacheData(url, contentType, data) {
	let cachedPages = await Storage.get("cachedPages");
	if (!cachedPages) {
		cachedPages = {};
	}

	cachedPages[url] = { isHtml: false, contentType, data };

	await Storage.set("cachedPages", cachedPages);
}

function processCachedHtml(baseUrl, cachedHtml) {
	// Replace relative URLs with absolute URLs
	cachedHtml = cachedHtml.replace(/(href|src)="(?!http)([^"]+)"/g, (_, p1, p2) => {
		return `${p1}="${baseUrl}${p2}"`;
	});

	// Remove csp tags
	cachedHtml = cachedHtml.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]+">/g, "");

	// Find inline scripts
	const inlineScripts = [];
	cachedHtml = cachedHtml.replace(/<script>([\s\S]+?)<\/script>/g, (_, p1) => {
		inlineScripts.push(p1);
		return "";
	});

	return {
		html: cachedHtml,
		inlineScripts,
	}
}

window.onload = async () => {
	const url = new URLSearchParams(window.location.search).get("url");
	const cache = await getCache(url);
	if (!cache) {
		document.body.innerText = "No cached data found";
		return;
	}

	const data = processCachedHtml(cache.baseUrl, cache.html);

	// create a new document
	document.open();
	document.write(data.html);
	document.close();

	// store the inline scripts in storage
	let inlineScripts = await Storage.get("inlineScripts");
	if (!inlineScripts) {
		inlineScripts = {};
	}
	inlineScripts[window.location.href] = data.inlineScripts;
	await Storage.set("inlineScripts", inlineScripts);

	const scriptElement = document.createElement("script");
	scriptElement.src = "/inline_scripts.js";
	document.body.appendChild(scriptElement);

	console.log("Loaded cached page:", url);
};
