"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
exports.fetchWikiSummary = fetchWikiSummary;
exports.fetchBingImages = fetchBingImages;
exports.fetchYoutubeResults = fetchYoutubeResults;
exports.fetchGoogleResults = fetchGoogleResults;
exports.fetchBingResults = fetchBingResults;
exports.fetchDuckDuckGoResults = fetchDuckDuckGoResults;
exports.fetchSearxResults = fetchSearxResults;
exports.fetchNewsResults = fetchNewsResults;
exports.getAggregatedWebResults = getAggregatedWebResults;
exports.checkBangRedirects = checkBangRedirects;
const jsdom_1 = require("jsdom");
const cacheStorage = new Map();
const cacheExpiration = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 500;
exports.Cache = {
    get: function (key) {
        const cacheItem = cacheStorage.get(key);
        if (cacheItem && cacheItem.expiry > Date.now()) {
            cacheStorage.delete(key);
            cacheStorage.set(key, cacheItem);
            return cacheItem.data;
        }
        cacheStorage.delete(key);
        return null;
    },
    set: function (key, data) {
        if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
            return;
        }
        if (cacheStorage.size >= MAX_CACHE_SIZE) {
            const oldestKey = cacheStorage.keys().next().value;
            if (oldestKey) {
                cacheStorage.delete(oldestKey);
            }
        }
        cacheStorage.set(key, {
            data,
            expiry: Date.now() + cacheExpiration
        });
    },
    getStorage: function () {
        return cacheStorage;
    },
    clear: function () {
        cacheStorage.clear();
    }
};
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SEARX_BASE_URL = "https://searx.be";
const GNEWS_API_KEY = "eaa76e708952a1df00eae28a4b2d3654";
const GNEWS_BASE_URL = "https://gnews.io/api/v4/search";
const langToCountryCode = {
    "tr": "tr",
    "en": "us",
    "de": "de",
};
function parseHTML(html) {
    const dom = new jsdom_1.JSDOM(html);
    return dom.window.document;
}
async function fetchWikiSummary(query, lang = "tr") {
    const cacheKey = `wiki_summary_${lang}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
            if (response.status === 404)
                exports.Cache.set(cacheKey, null);
            return null;
        }
        const data = await response.json();
        if (data && data.title && data.extract) {
            const summary = {
                title: data.title,
                summary: data.extract,
                img: data.thumbnail?.source || null,
                url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`
            };
            exports.Cache.set(cacheKey, summary);
            return summary;
        }
        exports.Cache.set(cacheKey, null);
        return null;
    }
    catch (error) {
        exports.Cache.set(cacheKey, null);
        return null;
    }
}
async function fetchBingImages(query, lang = "tr") {
    const countryCode = langToCountryCode[lang] || "us";
    const cacheKey = `bing_images_${lang}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const market = `${lang}-${countryCode.toUpperCase()}`;
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&mkt=${market}`;
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(7000) });
        const html = await response.text();
        const document = parseHTML(html);
        const images = [];
        document.querySelectorAll("a.iusc").forEach((el) => {
            const m_attr = el.getAttribute("m");
            if (m_attr) {
                try {
                    const m = JSON.parse(m_attr);
                    if (m && m.murl && m.t) {
                        images.push({
                            title: m.t || query,
                            image: m.murl,
                            thumbnail: m.turl || m.murl,
                            link: m.purl || url
                        });
                    }
                }
                catch (e) { }
            }
        });
        exports.Cache.set(cacheKey, images);
        return images;
    }
    catch (error) {
        exports.Cache.set(cacheKey, []);
        return [];
    }
}
async function fetchYoutubeResults(query, lang = "tr") {
    const cacheKey = `youtube_videos_${lang}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${lang}`;
        const response = await fetch(youtubeSearchUrl, {
            headers: { "User-Agent": USER_AGENT, "Accept-Language": `${lang}-${lang.toUpperCase()},${lang};q=0.9,en-US;q=0.8,en;q=0.7` },
            signal: AbortSignal.timeout(10000)
        });
        const html = await response.text();
        const videos = [];
        const regex = /var ytInitialData = ({.*?});<\/script>/s;
        const match = html.match(regex);
        if (match && match[1]) {
            try {
                const ytData = JSON.parse(match[1]);
                const contents = ytData.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
                if (contents) {
                    for (const item of contents) {
                        if (item.videoRenderer) {
                            const vr = item.videoRenderer;
                            videos.push({
                                title: vr.title?.runs?.[0]?.text || "No Title",
                                url: `https://www.youtube.com/watch?v=${vr.videoId}`,
                                thumbnail: vr.thumbnail?.thumbnails?.[0]?.url || "",
                                source: vr.ownerText?.runs?.[0]?.text || "YouTube"
                            });
                        }
                        if (videos.length >= 10)
                            break;
                    }
                }
            }
            catch (e) { }
        }
        exports.Cache.set(cacheKey, videos);
        return videos;
    }
    catch (error) {
        exports.Cache.set(cacheKey, []);
        return [];
    }
}
async function fetchGoogleResults(query, start = 0, lang = "tr") {
    const countryCode = langToCountryCode[lang] || "us";
    const cacheKey = `google_web_${lang}_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&hl=${lang}&gl=${countryCode}&lr=lang_${lang}`;
        const response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, "Accept-Language": `${lang}-${lang.toUpperCase()},${lang};q=0.9` },
            signal: AbortSignal.timeout(7000)
        });
        const html = await response.text();
        const document = parseHTML(html);
        const results = [];
        document.querySelectorAll("div.g").forEach((element) => {
            const linkElement = element.querySelector("a[jsname][href]");
            let resultUrl = linkElement?.getAttribute("href");
            const title = element.querySelector("h3")?.textContent?.trim() || "";
            const snippet = element.querySelector("div[data-sncf=\"1\"]")?.textContent?.trim() || "";
            if (resultUrl && title && !resultUrl.startsWith("/search") && !resultUrl.startsWith("#")) {
                if (resultUrl.startsWith("/url?q=")) {
                    try {
                        const parsedUrlParams = new URLSearchParams(resultUrl.split("?")[1]);
                        resultUrl = parsedUrlParams.get("q") || resultUrl;
                    }
                    catch (e) { }
                }
                try {
                    const parsedResultUrl = new URL(resultUrl);
                    const cleanDisplayUrl = parsedResultUrl.hostname.replace(/^www\./, "");
                    results.push({
                        title,
                        link: resultUrl,
                        snippet,
                        displayUrl: cleanDisplayUrl,
                        source: "Google"
                    });
                }
                catch (e) { }
            }
        });
        exports.Cache.set(cacheKey, results);
        return results;
    }
    catch (error) {
        exports.Cache.set(cacheKey, []);
        return [];
    }
}
async function fetchBingResults(query, start = 0, lang = "tr") {
    const first = start + 1;
    const countryCode = langToCountryCode[lang] || "us";
    const cacheKey = `bing_web_${lang}_${first}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const market = `${lang}-${countryCode.toUpperCase()}`;
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&mkt=${market}`;
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(7000) });
        const html = await response.text();
        const document = parseHTML(html);
        const results = [];
        document.querySelectorAll("li.b_algo").forEach((element) => {
            const titleNode = element.querySelector("h2 a");
            const title = titleNode?.textContent?.trim() || "";
            let resultUrl = titleNode?.getAttribute("href") || "";
            const snippet = element.querySelector(".b_caption p")?.textContent?.trim() ||
                element.querySelector("div.b_caption div.b_snippet")?.textContent?.trim() ||
                "";
            let finalLink = resultUrl;
            let displayUrl = "domain.com";
            if (resultUrl.includes("bing.com/ck/a?")) {
                try {
                    const urlParams = new URLSearchParams(resultUrl.split('?')[1]);
                    const encodedTargetUrl = urlParams.get('u');
                    if (encodedTargetUrl) {
                        let decoded = decodeURIComponent(encodedTargetUrl);
                        const base64Start = decoded.indexOf('aHR0');
                        if (base64Start !== -1) {
                            decoded = decoded.substring(base64Start);
                        }
                        else {
                            finalLink = resultUrl;
                        }
                        finalLink = Buffer.from(decoded, 'base64').toString('utf8');
                    }
                }
                catch (e) {
                    finalLink = resultUrl;
                }
            }
            if (title && finalLink) {
                try {
                    const parsedResultUrl = new URL(finalLink);
                    displayUrl = parsedResultUrl.hostname.replace(/^www\./, "");
                    results.push({
                        title,
                        link: finalLink,
                        snippet: snippet || "No summary found.",
                        displayUrl: displayUrl,
                        source: "Bing"
                    });
                }
                catch (e) {
                }
            }
        });
        exports.Cache.set(cacheKey, results);
        return results;
    }
    catch (error) {
        exports.Cache.set(cacheKey, []);
        return [];
    }
}
async function fetchDuckDuckGoResults(query, start = 0, lang = "tr") {
    const ddgStart = Math.floor(start / 10) * 20;
    const cacheKey = `duckduckgo_web_${lang}_${ddgStart}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const ddgLangCode = `${lang}-${lang.toUpperCase()}`;
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${ddgStart}&kl=${ddgLangCode}&df=`;
        const response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, "Accept-Language": `${ddgLangCode},${lang};q=0.8,en-US;q=0.5,en;q=0.3` },
            signal: AbortSignal.timeout(10000)
        });
        const html = await response.text();
        const document = parseHTML(html);
        const results = [];
        document.querySelectorAll("div.web-result").forEach((element) => {
            const titleElement = element.querySelector("h2 a.result__a, a.L4EwT6U8e1Y9j49_MIH8");
            const title = titleElement?.textContent?.trim() || "";
            let resultUrl = titleElement?.getAttribute("href") || "";
            const snippet = element.querySelector("a.result__snippet, .result__snippet, span.OgdwYG6KE2q5lMyNJA_L")?.textContent?.trim() || "";
            if (title && resultUrl) {
                if (resultUrl.startsWith("//duckduckgo.com/l/?uddg=")) {
                    try {
                        const params = new URLSearchParams(resultUrl.split("?")[1]);
                        const decodedUrl = decodeURIComponent(params.get("uddg") || "");
                        if (decodedUrl)
                            resultUrl = decodedUrl;
                    }
                    catch (e) { }
                }
                if (!resultUrl.startsWith("http"))
                    return;
                try {
                    const parsedResultUrl = new URL(resultUrl);
                    const cleanDisplayUrl = parsedResultUrl.hostname.replace(/^www\./, "");
                    results.push({
                        title,
                        link: resultUrl,
                        snippet,
                        displayUrl: cleanDisplayUrl,
                        source: "DuckDuckGo"
                    });
                }
                catch (e) { }
            }
        });
        exports.Cache.set(cacheKey, results);
        return results;
    }
    catch (error) {
        exports.Cache.set(cacheKey, []);
        return [];
    }
}
async function fetchSearxResults(query, numPages = 10, lang = "tr") {
    if (!SEARX_BASE_URL)
        return [];
    const cacheKey = `searx_web_html_pages_0_to_${numPages - 1}_${lang}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    const allSearxResults = [];
    const fetchedUrls = new Set();
    for (let page = 0; page < numPages; page++) {
        try {
            const url = `${SEARX_BASE_URL}/search?q=${encodeURIComponent(query)}&p=${page}&language=${lang}`;
            const response = await fetch(url, {
                headers: { "User-Agent": USER_AGENT, "Accept-Language": `${lang}-${lang.toUpperCase()},${lang};q=0.9,en;q=0.8`, "Referer": SEARX_BASE_URL },
                signal: AbortSignal.timeout(15000)
            });
            const html = await response.text();
            const document = parseHTML(html);
            document.querySelectorAll(".result").forEach((element) => {
                const titleElement = element.querySelector(".result-title a");
                const title = titleElement?.textContent?.trim() || "";
                let resultUrl = titleElement?.getAttribute("href") || "";
                const snippet = element.querySelector(".result-content .result-snippet")?.textContent?.trim() || "";
                if (resultUrl.startsWith("/url?")) {
                    try {
                        const realUrlParam = new URL(resultUrl, SEARX_BASE_URL).searchParams.get("q");
                        if (realUrlParam)
                            resultUrl = realUrlParam;
                    }
                    catch (e) { }
                }
                if (title && resultUrl && resultUrl !== "#" && !fetchedUrls.has(resultUrl)) {
                    try {
                        const parsedResultUrl = new URL(resultUrl);
                        const cleanDisplayUrl = parsedResultUrl.hostname.replace(/^www\./, "");
                        allSearxResults.push({
                            title,
                            link: resultUrl,
                            snippet: snippet || "No summary found.",
                            displayUrl: cleanDisplayUrl,
                            source: "Searx"
                        });
                        fetchedUrls.add(resultUrl);
                    }
                    catch (e) { }
                }
            });
        }
        catch (error) {
        }
    }
    exports.Cache.set(cacheKey, allSearxResults);
    return allSearxResults;
}
async function fetchNewsResults(query, lang = "tr") {
    const countryCode = langToCountryCode[lang] || "us";
    const cacheKey = `news_results_${lang}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `${GNEWS_BASE_URL}?q=${encodeURIComponent(query)}&lang=${lang}&country=${countryCode}&max=10&apikey=${GNEWS_API_KEY}`;
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(7000) });
        const data = await response.json();
        if (data && data.articles) {
            const newsResults = data.articles.map(article => ({
                title: article.title,
                snippet: article.description || "No summary found.",
                link: article.url,
                displayUrl: new URL(article.url).hostname.replace(/^www\./, ""),
                source: article.source?.name || "News Source",
                image: article.image,
                date: article.publishedAt
            }));
            exports.Cache.set(cacheKey, newsResults);
            return newsResults;
        }
        exports.Cache.set(cacheKey, []);
        return [];
    }
    catch (error) {
        exports.Cache.set(cacheKey, []);
        return [];
    }
}
function isUnwantedLanguage(text) {
    if (!text)
        return false;
    // Rusça/Kiril (\u0400-\u04FF), Yunanca (\u0370-\u03FF), İbranice (\u0590-\u05FF), Arapça (\u0600-\u06FF), CJK (Çince/Japonca/Korece: \u4E00-\u9FFF, \u3040-\u30FF, \u1100-\u11FF, \uAC00-\uD7A3)
    const unwantedScriptsRegex = /[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\u1100-\u11FF\uAC00-\uD7A3]/;
    return unwantedScriptsRegex.test(text);
}
function rankAndSortResults(results, query, lang) {
    const countryCode = langToCountryCode[lang] || "us";
    const specialEngTlds = ['.co.uk', '.com.au', '.co.nz', '.ca'];
    const genericTlds = ['.com', '.org', '.net', '.info', '.io', '.co', '.edu', '.gov'];
    const trTlds = ['.tr', '.com.tr', '.org.tr', '.net.tr', '.gov.tr', '.edu.tr'];
    const informativeSites = [
        'wikipedia.org',
        'reddit.com',
        'stackoverflow.com',
        'stackexchange.com',
        'quora.com',
        'imdb.com',
        'btt.community'
    ];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const lowerQuery = query.toLowerCase();
    // Genelleştirilmiş Mutlak Domain Eşleşmesi için sorguyu temizleme
    const normalizedQuery = lowerQuery
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/.*$/, "")
        .replace(/\.com|\.org|\.net|\.io|\.co|\.tr|\.de|\.us/g, "")
        .trim();
    const searchTargetDomain = normalizedQuery.split('.')[0];
    const getScore = (result) => {
        let score = 0;
        const lowerTitle = result.title.toLowerCase();
        const lowerSnippet = result.snippet.toLowerCase();
        try {
            const url = new URL(result.link);
            const hostname = url.hostname.toLowerCase();
            const cleanHostname = hostname.replace(/^www\./, "");
            // 1. MUTLAK DOMAIN ÖNCELİĞİ (15000 Puan) - Tüm diller için geçerli. Sorguyla eşleşen domain en üstte.
            if (searchTargetDomain.length > 0) {
                if (cleanHostname.includes(searchTargetDomain)) {
                    if (cleanHostname.split('.')[0] === searchTargetDomain) {
                        score += 15000;
                    }
                    else if (cleanHostname.includes(`.${searchTargetDomain}.`)) {
                        score += 10000;
                    }
                    else {
                        score += 5000;
                    }
                }
            }
            // 2. TAM İFADE EŞLEŞMESİ ÖNCELİĞİ (1000 Puan) 
            if (lowerTitle.includes(lowerQuery)) {
                score += 1000;
            }
            // 3. TÜRKÇE SİTE AGRESİF ÖNCELİĞİ (Sadece Türkçe sorgularda geçerli)
            if (lang === 'tr') {
                if (trTlds.some(tld => hostname.endsWith(tld))) {
                    score += 8000; // Agresif öncelik puanı: TR siteleri EN sitelerinden üstte kalır.
                }
            }
            // 4. Tekil Kelime Eşleşmeleri
            queryTerms.forEach(term => {
                if (lowerTitle.includes(term))
                    score += 70;
                if (lowerSnippet.includes(term))
                    score += 30;
            });
            // 5. Bilgilendirici Siteler Önceliği
            if (informativeSites.some(site => hostname.endsWith(site))) {
                score += 80;
            }
            // 6. Bölgesel Alan Adı (TLD) Önceliği - TR'nin haricindeki TLD'ler
            if (hostname.endsWith(`.${countryCode}`)) {
                score += 50;
            }
            else if (lang === 'en' && specialEngTlds.some(tld => hostname.endsWith(tld))) {
                score += 40;
            }
            else if (genericTlds.some(tld => hostname.endsWith(tld))) {
                score += 30;
            }
            else {
                score += 10;
            }
        }
        catch (e) {
            return 0;
        }
        score += Math.random() * 5;
        return score;
    };
    return results.sort((a, b) => getScore(b) - getScore(a));
}
async function getAggregatedWebResults(query, start = 0, lang = "tr") {
    const FULL_LIST_CACHE_KEY = `full_aggregated_web_${lang}_${query}`;
    let fullCombinedList = exports.Cache.get(FULL_LIST_CACHE_KEY) || [];
    if (fullCombinedList.length === 0) {
        try {
            const fetchPromises = [
                // Google: İlk 20 sonuç
                fetchGoogleResults(query, 0, lang),
                fetchGoogleResults(query, 10, lang),
                // Bing: İlk 20 sonuç
                fetchBingResults(query, 0, lang),
                fetchBingResults(query, 10, lang),
                // DuckDuckGo: İlk 40 sonuç
                fetchDuckDuckGoResults(query, 0, lang),
                fetchDuckDuckGoResults(query, 20, lang),
                // Searx: İlk 20 sonuç
                fetchSearxResults(query, 2, lang)
            ];
            const allFetchedResults = await Promise.all(fetchPromises.map(p => p.catch(e => { return []; })));
            const resultsMap = new Map();
            allFetchedResults.flat().forEach(item => {
                if (item?.link && item.title && !resultsMap.has(item.link)) {
                    resultsMap.set(item.link, item);
                }
            });
            fullCombinedList = Array.from(resultsMap.values());
            if (fullCombinedList.length > 0)
                exports.Cache.set(FULL_LIST_CACHE_KEY, fullCombinedList);
        }
        catch (error) {
            fullCombinedList = [];
        }
    }
    let filteredList = fullCombinedList;
    // Yabancı/istenmeyen alfabeleri (Çince, Kiril, Arapça, vb.) her dilde temizle
    filteredList = fullCombinedList.filter(result => !isUnwantedLanguage(result.title) && !isUnwantedLanguage(result.snippet));
    const sortedList = rankAndSortResults(filteredList, query, lang);
    exports.Cache.clear();
    return sortedList;
}
function checkBangRedirects(query) {
    const parts = query.split(" ");
    const bang = parts[0].toLowerCase();
    const searchQuery = parts.slice(1).join(" ");
    const bangs = {
        "!g": "https://www.google.com/search?q=",
        "!w": "https://www.wikipedia.org/w/index.php?search=",
        "!bing": "https://www.bing.com/search?q=",
        "!ddg": "https://duckduckgo.com/?q=",
        "!amazon": "https://www.amazon.com/s?k=",
        "!yt": "https://www.youtube.com/results?search_query=",
        "!news": "https://news.google.com/search?q=",
        "!gh": "https://github.com/search?q=",
        "!so": "https://stackoverflow.com/search?q=",
        "!r": "https://www.reddit.com/search?q=",
        "!t": "https://twitter.com/search?q=",
        "!imdb": "https://www.imdb.com/find/?q=",
        "!npm": "https://www.npmjs.com/search?q=",
        "!mdn": "https://developer.mozilla.org/en-US/search?q=",
        "!wiki": "https://en.wikipedia.org/wiki/Special:Search?search=",
        "!maps": "https://www.google.com/maps/search/",
        "!wa": "https://www.wolframalpha.com/input?i=",
        "!urban": "https://www.urbandictionary.com/define.php?term=",
        "!etsy": "https://www.etsy.com/search?q=",
        "!ebay": "https://www.ebay.com/sch/i.html?_nkw="
    };
    if (bangs[bang]) {
        return `${bangs[bang]}${encodeURIComponent(searchQuery)}`;
    }
    return null;
}
