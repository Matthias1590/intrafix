let avoidCache = false;

const CACHE_URLS = [
	"https://projects.intra.42.fr/",
	"https://projects.intra.42.fr/projects/list",
];

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

function isHtml(text) {
	text = text.toLowerCase().trim();
	return text.startsWith("<!doctype html")
		|| text.startsWith("<html");
}

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
		if (avoidCache) {
			return {};
		}

        const url = details.url;

		if (url.includes("https://projects.intra.42.fr/project_data.json?") && !CACHE_URLS.includes(url)) {
			CACHE_URLS.push(url);
		}

		if (!CACHE_URLS.includes(url)) {
			return {};
		}

		console.log("Loading URL:", url);
        
        // Return cached response if available
		let cached = await getCache(url);
        if (cached != null) {
			console.log("Serving cached version of:", url);
			console.log("Is html?", cached.isHtml);
			if (cached.isHtml) {
				return { redirectUrl: chrome.runtime.getURL("cache_viewer.html") + `?url=${encodeURIComponent(url)}` };
			} else {
				window.data = cached.data;  // for some reason without this line, json isnt cached for some reason
				return { redirectUrl: `data:${cached.contentType};base64,${btoa(unescape(encodeURIComponent(data)))}` };
			}
        }

        // Fetch and cache the response
		console.log("Serving original version of:", url);
        try {
			avoidCache = true;
            const response = await fetch(url);
			avoidCache = false;
			const baseUrl = new URL(url).origin;
            const text = await response.text();
			if (isHtml(text)) {
				await setCache(url, baseUrl, text);
			} else {
				const contentType = response.headers.get("content-type").split(";")[0];
				await setCacheData(url, contentType, text);
			}
			console.log("Cached URL:", url);
        } catch (error) {
            console.error("Failed to cache:", url, error);
        }

        return {}; // Let request proceed normally if not cached
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);

// Clear storage
chrome.storage.local.clear();

// Start a fetch loop to cache the pages every 1 minute
async function updateCache() {
	console.log("Updating cache");

	for (const url of CACHE_URLS) {
		try {
			await fetch(url);
		} catch (error) {
			console.error("Failed to cache:", url, error);
		}
	}

	setTimeout(updateCache, 60000);
}

updateCache();

console.log("IntraFix loaded");
