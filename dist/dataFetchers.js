"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_AGENT = exports.Cache = void 0;
exports.fetchWikiSummary = fetchWikiSummary;
exports.fetchGoogleResults = fetchGoogleResults;
exports.fetchBingResults = fetchBingResults;
exports.fetchDuckDuckGoResults = fetchDuckDuckGoResults;
exports.fetchYandexResults = fetchYandexResults;
exports.fetchEcosiaResults = fetchEcosiaResults;
exports.fetchGoogleNewsResults = fetchGoogleNewsResults;
exports.fetchYahooNewsResults = fetchYahooNewsResults;
exports.fetchBingImages = fetchBingImages;
exports.fetchGoogleImages = fetchGoogleImages;
exports.fetchDuckDuckGoImages = fetchDuckDuckGoImages;
exports.fetchYoutubeResults = fetchYoutubeResults;
exports.fetchVimeoResults = fetchVimeoResults;
exports.fetchTwitterResults = fetchTwitterResults;
exports.getAggregatedWebResults = getAggregatedWebResults;
exports.getAggregatedImageResults = getAggregatedImageResults;
exports.getAggregatedVideoResults = getAggregatedVideoResults;
exports.getAggregatedNewsResults = getAggregatedNewsResults;
exports.checkBangRedirects = checkBangRedirects;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const url_1 = require("url");
const cacheStorage = new Map();
const cacheExpiration = 15 * 60 * 1000;
exports.Cache = {
    get: function (key) {
        const cacheItem = cacheStorage.get(key);
        if (cacheItem && cacheItem.expiry > Date.now()) {
            return cacheItem.data;
        }
        cacheStorage.delete(key);
        return null;
    },
    set: function (key, data) {
        if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
            return;
        }
        cacheStorage.set(key, {
            data,
            expiry: Date.now() + cacheExpiration
        });
    },
    getStorage: function () {
        return cacheStorage;
    }
};
exports.USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Türkçe dil karakterlerini ve kelimelerini kontrol eden basit bir fonksiyon
function isLikelyTurkish(text) {
    // Türkçe karakterler (örneğin, ç, ş, ğ, ü, ö, ı)
    const turkishChars = /[çÇğĞıİöÖşŞüÜ]/;
    // Türkçe yaygın kelimeler veya ekler
    const turkishPatterns = /\b(bir|ve|ile|de|da|dan|nin|ın|in|un|ün|mı|mi|mu|bu|şu|o)\b/i;
    return turkishChars.test(text) || turkishPatterns.test(text);
}
// Türkçe sonuçları filtreleyen yardımcı fonksiyon
function filterTurkishResults(results) {
    return results.filter(result => {
        const textToCheck = `${result.title} ${result.snippet || ''}`;
        return isLikelyTurkish(textToCheck);
    });
}
async function fetchWikiSummary(query, lang = 'tr') {
    var _a, _b, _c, _d;
    const cacheKey = `wiki_${lang}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'application/json',
                'X-Language': 'tr'
            },
            timeout: 5000
        });
        const wikiData = {
            title: data.title,
            summary: data.extract,
            img: ((_a = data.thumbnail) === null || _a === void 0 ? void 0 : _a.source) || null,
            url: ((_c = (_b = data.content_urls) === null || _b === void 0 ? void 0 : _b.desktop) === null || _c === void 0 ? void 0 : _c.page) || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        };
        // Türkçe dil kontrolü
        if (!isLikelyTurkish(wikiData.title + ' ' + wikiData.summary)) {
            return null;
        }
        exports.Cache.set(cacheKey, wikiData);
        return wikiData;
    }
    catch (error) {
        if (((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 404) {
            exports.Cache.set(cacheKey, null);
        }
        else {
            console.error(`Wikipedia fetch error for "${query}":`, error.message);
        }
        return null;
    }
}
async function fetchGoogleResults(query, start = 0) {
    const cacheKey = `google_web_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&hl=tr&gl=tr&lr=lang_tr&cr=countryTR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results = [];
        $('div.g').each((_, element) => {
            var _a, _b, _c;
            const linkElement = $(element).find('a[jsname][href]');
            let url = linkElement.attr('href');
            const title = ((_a = $(element).find('h3').text()) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            const snippetElement = $(element).find('div[data-sncf="1"]');
            const snippet = ((_b = snippetElement.text()) === null || _b === void 0 ? void 0 : _b.trim()) || '';
            const displayUrl = ((_c = $(element).find('cite').first().text()) === null || _c === void 0 ? void 0 : _c.trim()) || '';
            if (url && title && !url.startsWith('/search') && !url.startsWith('#')) {
                if (url.startsWith('/url?q=')) {
                    try {
                        const parsedUrl = new url_1.URLSearchParams(url.split('?')[1]);
                        url = parsedUrl.get('q') || url;
                    }
                    catch (e) {
                        console.error("Failed to parse Google redirect URL:", e.message);
                    }
                }
                try {
                    const parsedUrl = new URL(url);
                    results.push({
                        title,
                        link: url,
                        snippet,
                        displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                        source: 'Google'
                    });
                }
                catch (e) {
                    console.error("Failed to parse result URL for Google:", e.message, url);
                }
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(results);
        const slicedResults = filteredResults.slice(0, 10);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('Google fetch error:', error.message);
        return [];
    }
}
async function fetchBingResults(query, start = 0) {
    const first = start + 1;
    const cacheKey = `bing_web_${first}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&setlang=tr-TR&cc=TR&mkt=tr-TR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results = [];
        $('li.b_algo').each((_, element) => {
            const titleNode = $(element).find('h2 a');
            const title = titleNode.text().trim() || '';
            const url = titleNode.attr('href') || '';
            const snippetNode = $(element).find('.b_caption p');
            const snippet = snippetNode.text().trim() || '';
            const displayUrl = $(element).find('cite').text().trim() || '';
            if (title && url) {
                try {
                    const parsedUrl = new URL(url);
                    results.push({
                        title,
                        link: url,
                        snippet,
                        displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                        source: 'Bing'
                    });
                }
                catch (e) {
                    console.error("Failed to parse result URL for Bing:", e.message, url);
                }
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(results);
        const slicedResults = filteredResults.slice(0, 10);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('Bing fetch error:', error.message);
        return [];
    }
}
async function fetchDuckDuckGoResults(query, start = 0) {
    const cacheKey = `duckduckgo_web_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${start}&kl=tr-tr&kp=-2`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'X-Language': 'tr'
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const results = [];
        $('div.result').each((_, element) => {
            const titleElement = $(element).find('a.result__a');
            const title = titleElement.text().trim() || '';
            let url = titleElement.attr('href') || '';
            const snippet = $(element).find('div.result__snippet').text().trim() || '';
            const displayUrl = $(element).find('a.result__url').text().trim() || '';
            if (title && url) {
                if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
                    try {
                        const params = new url_1.URLSearchParams(url.split('?')[1]);
                        url = decodeURIComponent(params.get('uddg') || '');
                    }
                    catch (e) {
                        console.error("Failed to parse DuckDuckGo redirect URL:", e.message, url);
                        return;
                    }
                }
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                }
                try {
                    const parsedUrl = new URL(url);
                    results.push({
                        title,
                        link: url,
                        snippet,
                        displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                        source: 'DuckDuckGo'
                    });
                }
                catch (e) {
                    console.error("Failed to parse result URL for DuckDuckGo:", e.message, url);
                }
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(results);
        const slicedResults = filteredResults.slice(0, 10);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('DuckDuckGo fetch error:', error.message);
        return [];
    }
}
async function fetchYandexResults(query, start = 0) {
    const cacheKey = `yandex_web_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://yandex.com.tr/search/?text=${encodeURIComponent(query)}&p=${Math.floor(start / 10)}&lr=113&lang=tr`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results = [];
        $('li.serp-item').each((_, element) => {
            const titleElement = $(element).find('h2 a');
            const title = titleElement.text().trim() || '';
            const url = titleElement.attr('href') || '';
            const snippet = $(element).find('div.organic__content-wrapper').text().trim() || '';
            const displayUrl = $(element).find('div.path a').text().trim() || '';
            if (title && url) {
                try {
                    const parsedUrl = new URL(url);
                    results.push({
                        title,
                        link: url,
                        snippet,
                        displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                        source: 'Yandex'
                    });
                }
                catch (e) {
                    console.error("Failed to parse result URL for Yandex:", e.message, url);
                }
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(results);
        const slicedResults = filteredResults.slice(0, 10);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('Yandex fetch error:', error.message);
        return [];
    }
}
async function fetchEcosiaResults(query, start = 0) {
    var _a;
    const cacheKey = `ecosia_web_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    const maxRetries = 2;
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const url = `https://www.ecosia.org/search?q=${encodeURIComponent(query)}&p=${Math.floor(start / 10)}&l=tr`;
            const { data } = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': exports.USER_AGENT,
                    'Accept-Language': 'tr-TR,tr;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Referer': 'https://www.ecosia.org/',
                    'Upgrade-Insecure-Requests': '1',
                    'X-Language': 'tr'
                },
                timeout: 12000
            });
            const $ = cheerio.load(data);
            const results = [];
            $('div.result').each((_, element) => {
                const titleElement = $(element).find('a.result-title');
                const title = titleElement.text().trim() || '';
                const url = titleElement.attr('href') || '';
                const snippet = $(element).find('p.result-snippet').text().trim() || '';
                const displayUrl = $(element).find('span.result-url').text().trim() || '';
                if (title && url) {
                    try {
                        const parsedUrl = new URL(url);
                        results.push({
                            title,
                            link: url,
                            snippet,
                            displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                            source: 'Ecosia'
                        });
                    }
                    catch (e) {
                        console.error("Failed to parse result URL for Ecosia:", e.message, url);
                    }
                }
            });
            // Türkçe sonuçları filtrele
            const filteredResults = filterTurkishResults(results);
            const slicedResults = filteredResults.slice(0, 10);
            exports.Cache.set(cacheKey, slicedResults);
            return slicedResults;
        }
        catch (error) {
            console.error(`Ecosia fetch error (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
            if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 403 && attempt < maxRetries) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            return [];
        }
    }
    return [];
}
async function fetchGoogleNewsResults(query, start = 0) {
    const cacheKey = `google_news_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&start=${start}&hl=tr&gl=tr&lr=lang_tr&cr=countryTR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const newsResults = [];
        $('a[jsname][href]').closest('div.SoaBEf').each((_, element) => {
            var _a;
            const linkElement = $(element).find('a[jsname][href]');
            let url = linkElement.attr('href');
            const title = $(element).find('div[role="heading"]').text().trim() || '';
            const snippet = $(element).find('div.GI74Re').text().trim() || '';
            const sourceAndTime = $(element).find('div.XTjFC.WF4CUc').text().trim() || '';
            const imageElement = $(element).find('img.wFSVIb');
            const image = imageElement.attr('src');
            if (url && title) {
                if (url.startsWith('/url?q=')) {
                    try {
                        const parsedUrl = new url_1.URLSearchParams(url.split('?')[1]);
                        url = parsedUrl.get('q') || url;
                    }
                    catch (e) {
                        console.error("Failed to parse Google News redirect URL:", e.message);
                    }
                }
                const source = ((_a = sourceAndTime.split('·')[0]) === null || _a === void 0 ? void 0 : _a.trim()) || 'Bilinmeyen Kaynak';
                newsResults.push({
                    news: title,
                    link: url || '#',
                    snippet: snippet,
                    source: source,
                    image: image || null
                });
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(newsResults);
        const slicedResults = filteredResults.slice(0, 12);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('Google News fetch error:', error.message);
        return [];
    }
}
async function fetchYahooNewsResults(query, start = 0) {
    const cacheKey = `yahoo_news_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://news.search.yahoo.com/search?p=${encodeURIComponent(query)}&b=${start + 1}&pz=10&lang=tr&locale=tr_TR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const newsResults = [];
        $('div.NewsArticle').each((_, element) => {
            const titleElement = $(element).find('h4 a');
            const title = titleElement.text().trim() || '';
            const url = titleElement.attr('href') || '';
            const snippet = $(element).find('p').text().trim() || '';
            const source = $(element).find('span.s-source').text().trim() || 'Yahoo Haber';
            const imageElement = $(element).find('img');
            const image = imageElement.attr('src') || null;
            if (title && url) {
                newsResults.push({
                    news: title,
                    link: url,
                    snippet,
                    source,
                    image
                });
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(newsResults);
        const slicedResults = filteredResults.slice(0, 12);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('Yahoo News fetch error:', error.message);
        return [];
    }
}
async function fetchBingImages(query) {
    const cacheKey = `bing_images_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&setlang=tr-TR&cc=TR&mkt=tr-TR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'X-Language': 'tr'
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const images = [];
        let count = 0;
        $('li.dg_u, div.imgpt, div.dgControl.hover, .img_cont').each((_, el) => {
            if (count >= 50)
                return false;
            const jsonData = $(el).find('a.iusc').attr('m');
            if (jsonData) {
                try {
                    const imgData = JSON.parse(jsonData);
                    const murl = imgData.murl;
                    const turl = imgData.turl;
                    const title = imgData.t;
                    if (murl && murl.startsWith('http')) {
                        images.push({
                            image: murl,
                            thumbnail: turl || murl,
                            title: title || query,
                            link: imgData.purl || '#'
                        });
                        count++;
                    }
                }
                catch (e) {
                    console.error("Failed to parse Bing image JSON data:", e.message);
                    const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
                    if (imgSrc && imgSrc.startsWith('http')) {
                        images.push({
                            image: imgSrc,
                            thumbnail: imgSrc,
                            title: $(el).find('img').attr('alt') || query,
                            link: $(el).find('a').attr('href') || '#'
                        });
                        count++;
                    }
                }
            }
            else {
                const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
                if (imgSrc && imgSrc.startsWith('http')) {
                    images.push({
                        image: imgSrc,
                        thumbnail: imgSrc,
                        title: $(el).find('img').attr('alt') || query,
                        link: $(el).find('a').attr('href') || '#'
                    });
                    count++;
                }
            }
        });
        // Türkçe başlıkları filtrele
        const filteredImages = images.filter(image => isLikelyTurkish(image.title));
        exports.Cache.set(cacheKey, filteredImages);
        return filteredImages;
    }
    catch (err) {
        console.error('Bing images fetch error:', err.message);
        return [];
    }
}
async function fetchGoogleImages(query) {
    const cacheKey = `google_images_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&hl=tr&gl=tr&lr=lang_tr&cr=countryTR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'X-Language': 'tr'
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const images = [];
        let count = 0;
        $('div.isv-r').each((_, element) => {
            if (count >= 50)
                return false;
            const imgElement = $(element).find('img');
            const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
            const title = imgElement.attr('alt') || query;
            const linkElement = $(element).find('a[href]');
            let link = linkElement.attr('href') || '#';
            if (imgSrc && imgSrc.startsWith('http')) {
                if (link.startsWith('/url?q=')) {
                    try {
                        const parsedUrl = new url_1.URLSearchParams(link.split('?')[1]);
                        link = parsedUrl.get('q') || link;
                    }
                    catch (e) {
                        console.error("Failed to parse Google Images redirect URL:", e.message);
                    }
                }
                images.push({
                    image: imgSrc,
                    thumbnail: imgSrc,
                    title,
                    link
                });
                count++;
            }
        });
        // Türkçe başlıkları filtrele
        const filteredImages = images.filter(image => isLikelyTurkish(image.title));
        exports.Cache.set(cacheKey, filteredImages);
        return filteredImages;
    }
    catch (error) {
        console.error('Google Images fetch error:', error.message);
        return [];
    }
}
async function fetchDuckDuckGoImages(query) {
    const cacheKey = `duckduckgo_images_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images&kl=tr-tr`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'X-Language': 'tr'
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const images = [];
        let count = 0;
        $('div.tile--img').each((_, element) => {
            if (count >= 50)
                return false;
            const imgElement = $(element).find('img.tile--img__img');
            const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
            const title = imgElement.attr('alt') || query;
            const link = $(element).find('a').attr('href') || '#';
            if (imgSrc && imgSrc.startsWith('http')) {
                images.push({
                    image: imgSrc,
                    thumbnail: imgSrc,
                    title,
                    link
                });
                count++;
            }
        });
        // Türkçe başlıkları filtrele
        const filteredImages = images.filter(image => isLikelyTurkish(image.title));
        exports.Cache.set(cacheKey, filteredImages);
        return filteredImages;
    }
    catch (error) {
        console.error('DuckDuckGo Images fetch error:', error.message);
        return [];
    }
}
async function fetchYoutubeResults(query) {
    var _a, _b, _c, _d, _e, _f;
    const cacheKey = `youtube_videos_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=tr&gl=TR`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'X-Language': 'tr'
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const videos = [];
        let initialData = null;
        $('script').each((_, script) => {
            const scriptContent = $(script).html();
            if (scriptContent === null || scriptContent === void 0 ? void 0 : scriptContent.includes('var ytInitialData = ')) {
                try {
                    const jsonMatch = scriptContent.match(/var ytInitialData = ({[\s\S]*?});/);
                    if (jsonMatch && jsonMatch[1]) {
                        const jsonData = jsonMatch[1];
                        initialData = JSON.parse(jsonData);
                        return false;
                    }
                }
                catch (e) {
                    console.error("Failed to parse ytInitialData from www.youtube.com:", e.message, scriptContent.slice(0, 100));
                }
            }
        });
        if (initialData) {
            const contents = (_d = (_c = (_b = (_a = initialData === null || initialData === void 0 ? void 0 : initialData.contents) === null || _a === void 0 ? void 0 : _a.twoColumnSearchResultsRenderer) === null || _b === void 0 ? void 0 : _b.primaryContents) === null || _c === void 0 ? void 0 : _c.sectionListRenderer) === null || _d === void 0 ? void 0 : _d.contents;
            const itemSection = (_f = (_e = contents === null || contents === void 0 ? void 0 : contents.find((c) => c.itemSectionRenderer)) === null || _e === void 0 ? void 0 : _e.itemSectionRenderer) === null || _f === void 0 ? void 0 : _f.contents;
            if (itemSection) {
                itemSection.forEach((item) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                    const videoRenderer = item.videoRenderer;
                    if (videoRenderer) {
                        const videoId = videoRenderer.videoId;
                        const title = ((_c = (_b = (_a = videoRenderer.title) === null || _a === void 0 ? void 0 : _a.runs) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) || ((_d = videoRenderer.title) === null || _d === void 0 ? void 0 : _d.simpleText) || 'Bilinmeyen Video';
                        const thumbnail = ((_g = (_f = (_e = videoRenderer.thumbnail) === null || _e === void 0 ? void 0 : _e.thumbnails) === null || _f === void 0 ? void 0 : _f.sort((a, b) => (b.width || 0) - (a.width || 0))[0]) === null || _g === void 0 ? void 0 : _g.url) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                        const channel = ((_k = (_j = (_h = videoRenderer.ownerText) === null || _h === void 0 ? void 0 : _h.runs) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.text) || 'Bilinmeyen Kaynak';
                        if (videoId && title) {
                            videos.push({
                                title,
                                url: `https://www.youtube.com/watch?v=${videoId}`,
                                thumbnail: thumbnail,
                                source: channel
                            });
                        }
                    }
                });
            }
        }
        if (videos.length < 5) {
            console.warn("Yetersiz sonuç, m.youtube.com'a geçiliyor.");
            const mobileUrl = `https://m.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=tr&gl=TR`;
            const mobileResponse = await axios_1.default.get(mobileUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36',
                    'Accept-Language': 'tr-TR,tr;q=0.9',
                    'X-Language': 'tr'
                },
                timeout: 10000
            });
            const mobile$ = cheerio.load(mobileResponse.data);
            mobile$('ytm-compact-video-renderer').each((_, element) => {
                const titleElement = $(element).find('.compact-media-item-headline');
                const title = titleElement.text().trim();
                const videoHref = $(element).attr('href');
                const videoIdMatch = videoHref === null || videoHref === void 0 ? void 0 : videoHref.match(/\/watch\?v=([a-zA-Z0-9_-]+)/);
                const videoId = videoIdMatch ? videoIdMatch[1] : null;
                const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
                const thumbnailElement = $(element).find('img');
                const thumbnail = thumbnailElement.attr('src');
                const channelElement = $(element).find('.compact-media-item-byline');
                const channel = channelElement.text().trim();
                if (title && url && videoId) {
                    videos.push({
                        title,
                        url,
                        thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        source: channel || 'YouTube'
                    });
                }
            });
        }
        // Türkçe başlıkları filtrele
        const filteredVideos = videos.filter(video => isLikelyTurkish(video.title));
        const slicedVideos = filteredVideos.slice(0, 12);
        exports.Cache.set(cacheKey, slicedVideos);
        return slicedVideos;
    }
    catch (error) {
        console.error('YouTube fetch error:', error.message);
        return [];
    }
}
async function fetchVimeoResults(query) {
    const cacheKey = `vimeo_videos_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://vimeo.com/search?q=${encodeURIComponent(query)}&lang=tr`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 8000
        });
        const $ = cheerio.load(data);
        const videos = [];
        $('li.search-results-item').each((_, element) => {
            var _a;
            const titleElement = $(element).find('a.iris_link');
            const title = ((_a = titleElement.attr('title')) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            const url = `https://vimeo.com${titleElement.attr('href') || ''}`;
            const thumbnailElement = $(element).find('img');
            const thumbnail = thumbnailElement.attr('src') || '';
            const source = $(element).find('a.iris_user').text().trim() || 'Vimeo';
            if (title && url) {
                videos.push({
                    title,
                    url,
                    thumbnail,
                    source
                });
            }
        });
        // Türkçe başlıkları filtrele
        const filteredVideos = videos.filter(video => isLikelyTurkish(video.title));
        const slicedVideos = filteredVideos.slice(0, 12);
        exports.Cache.set(cacheKey, slicedVideos);
        return slicedVideos;
    }
    catch (error) {
        console.error('Vimeo fetch error:', error.message);
        return [];
    }
}
async function fetchTwitterResults(query) {
    const cacheKey = `twitter_web_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const url = `https://x.com/search?q=${encodeURIComponent(query)}&lang=tr`;
        const { data } = await axios_1.default.get(url, {
            headers: {
                'User-Agent': exports.USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'X-Language': 'tr'
            },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results = [];
        $('article').each((_, element) => {
            const tweetElement = $(element).find('div[lang]');
            const snippet = tweetElement.text().trim() || '';
            const linkElement = $(element).find('a[href*="/status/"]');
            const link = `https://x.com${linkElement.attr('href') || ''}`;
            const title = snippet.length > 50 ? `${snippet.substring(0, 47)}...` : snippet;
            const username = $(element).find('a[role="link"]').first().text().trim() || 'X Kullanıcısı';
            if (snippet && link) {
                results.push({
                    title,
                    link,
                    snippet,
                    displayUrl: username,
                    source: 'X'
                });
            }
        });
        // Türkçe sonuçları filtrele
        const filteredResults = filterTurkishResults(results);
        const slicedResults = filteredResults.slice(0, 10);
        exports.Cache.set(cacheKey, slicedResults);
        return slicedResults;
    }
    catch (error) {
        console.error('Twitter/X fetch error:', error.message);
        return [];
    }
}
async function getAggregatedWebResults(query, start = 0) {
    const cacheKey = `aggregated_web_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const [googleResults, bingResults, duckDuckGoResults, yandexResults, ecosiaResults, twitterResults] = await Promise.all([
            fetchGoogleResults(query, start),
            fetchBingResults(query, start),
            fetchDuckDuckGoResults(query, start),
            fetchYandexResults(query, start),
            fetchEcosiaResults(query, start),
            fetchTwitterResults(query)
        ]);
        const resultsMap = new Map();
        [googleResults, bingResults, duckDuckGoResults, yandexResults, ecosiaResults, twitterResults].forEach(results => {
            results.forEach(item => {
                if (!resultsMap.has(item.link)) {
                    resultsMap.set(item.link, item);
                }
            });
        });
        const combined = Array.from(resultsMap.values());
        const slicedCombined = combined.slice(0, 10);
        exports.Cache.set(cacheKey, slicedCombined);
        return slicedCombined;
    }
    catch (error) {
        console.error('Aggregated search error:', error.message);
        return [];
    }
}
async function getAggregatedImageResults(query) {
    const cacheKey = `aggregated_images_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const [bingImages, googleImages, duckDuckGoImages] = await Promise.all([
            fetchBingImages(query),
            fetchGoogleImages(query),
            fetchDuckDuckGoImages(query)
        ]);
        const imagesMap = new Map();
        [bingImages, googleImages, duckDuckGoImages].forEach(images => {
            images.forEach(item => {
                if (!imagesMap.has(item.image) && item.image && item.image.startsWith('http')) {
                    imagesMap.set(item.image, item);
                }
            });
        });
        const combined = Array.from(imagesMap.values());
        const slicedCombined = combined.slice(0, 100);
        exports.Cache.set(cacheKey, slicedCombined);
        return slicedCombined;
    }
    catch (error) {
        console.error('Aggregated images error:', error.message);
        return [];
    }
}
async function getAggregatedVideoResults(query) {
    const cacheKey = `aggregated_videos_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const [youtubeResults, vimeoResults] = await Promise.all([
            fetchYoutubeResults(query),
            fetchVimeoResults(query)
        ]);
        const videosMap = new Map();
        [youtubeResults, vimeoResults].forEach(videos => {
            videos.forEach(item => {
                if (!videosMap.has(item.url)) {
                    videosMap.set(item.url, item);
                }
            });
        });
        const combined = Array.from(videosMap.values());
        const slicedCombined = combined.slice(0, 12);
        exports.Cache.set(cacheKey, slicedCombined);
        return slicedCombined;
    }
    catch (error) {
        console.error('Aggregated videos error:', error.message);
        return [];
    }
}
async function getAggregatedNewsResults(query, start = 0) {
    const cacheKey = `aggregated_news_${start}_${query}`;
    const cachedData = exports.Cache.get(cacheKey);
    if (cachedData)
        return cachedData;
    try {
        const [googleNews, yahooNews] = await Promise.all([
            fetchGoogleNewsResults(query, start),
            fetchYahooNewsResults(query, start)
        ]);
        const newsMap = new Map();
        [googleNews, yahooNews].forEach(news => {
            news.forEach(item => {
                if (!newsMap.has(item.link)) {
                    newsMap.set(item.link, item);
                }
            });
        });
        const combined = Array.from(newsMap.values());
        const slicedCombined = combined.slice(0, 12);
        exports.Cache.set(cacheKey, slicedCombined);
        return slicedCombined;
    }
    catch (error) {
        console.error('Aggregated news error:', error.message);
        return [];
    }
}
function checkBangRedirects(query) {
    if (!query.startsWith('!'))
        return null;
    const parts = query.substring(1).split(' ');
    const command = parts[0].toLowerCase();
    const searchQuery = parts.slice(1).join(' ');
    const bangRedirects = {
        github: "https://github.com/search?q=", gh: "https://github.com/search?q=",
        google: "https://www.google.com/search?q=", g: "https://www.google.com/search?q=",
        yt: "https://www.youtube.com/results?search_query=", youtube: "https://www.youtube.com/results?search_query=",
        wikipedia: "https://tr.wikipedia.org/wiki/", wiki: "https://tr.wikipedia.org/wiki/", wp: "https://tr.wikipedia.org/wiki/",
        yahoo: "https://search.yahoo.com/search?p=", y: "https://search.yahoo.com/search?p=",
        bing: "https://www.bing.com/search?q=", b: "https://www.bing.com/search?q=",
        scholar: "https://scholar.google.com/scholar?q=",
        base: "https://www.base-search.net/Search/Results?lookfor=",
        ddg: "https://duckduckgo.com/?q=", duckduckgo: "https://duckduckgo.com/?q=",
        yandex: "https://yandex.com.tr/search/?text=",
        ecosia: "https://www.ecosia.org/search?q=",
        twitter: "https://x.com/search?q=", x: "https://x.com/search?q=",
        vimeo: "https://vimeo.com/search?q="
    };
    const redirectUrl = bangRedirects[command];
    if (redirectUrl) {
        if (searchQuery) {
            return redirectUrl + encodeURIComponent(searchQuery);
        }
        else {
            try {
                const baseUrlWithoutParams = redirectUrl.split('?')[0];
                return baseUrlWithoutParams;
            }
            catch (e) {
                console.error("Failed to parse redirect URL for bang command:", e.message, redirectUrl);
                return redirectUrl;
            }
        }
    }
    return null;
}
