import axios from 'axios';
import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';

// Interfaces and other unchanged types remain the same
interface WikipediaSummaryApiResponse {
    title: string;
    extract: string;
    thumbnail?: {
        source: string;
        width: number;
        height: number;
    };
    content_urls?: {
        desktop?: {
            page: string;
        };
    };
}

export interface WikiSummary {
    title: string;
    summary: string;
    img: string | null;
    url: string;
}

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    displayUrl: string;
    source: string;
}

export interface NewsResult {
    news: string;
    link: string;
    snippet: string;
    source: string;
    image: string | null;
}

export interface ImageResult {
    image: string;
    thumbnail: string | null;
    title: string;
    link: string;
}

export interface VideoResult {
    title: string;
    url: string;
    thumbnail: string;
    source: string;
}

export interface CacheItem<T> {
    data: T | null;
    expiry: number;
}

export interface IPInfoData {
    country: string;
}

const cacheStorage = new Map<string, CacheItem<any>>();
const cacheExpiration = 15 * 60 * 1000;

export const Cache = {
    get: function<T>(key: string): T | null {
        const cacheItem = cacheStorage.get(key) as CacheItem<T> | undefined;
        if (cacheItem && cacheItem.expiry > Date.now()) {
            return cacheItem.data;
        }
        cacheStorage.delete(key);
        return null;
    },
    set: function<T>(key: string, data: T | null): void {
        if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
            return;
        }
        cacheStorage.set(key, {
            data,
            expiry: Date.now() + cacheExpiration
        });
    },
    get: function() {
        return cacheStorage;
    }
};

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Updated isTurkishDomain function to strictly check for .tr TLDs
function isTurkishDomain(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        // List of valid Turkish TLDs and second-level domains
        const turkishTlds = [
            '.tr',
            '.com.tr',
            '.org.tr',
            '.gov.tr',
            '.edu.tr',
            '.mil.tr',
            '.net.tr',
            '.gen.tr',
            '.biz.tr',
            '.info.tr',
            '.web.tr',
            '.name.tr',
            '.av.tr',
            '.dr.tr',
            '.bel.tr',
            '.pol.tr',
            '.k12.tr',
            '.tsk.tr'
        ];
        // Check if the hostname ends with a valid Turkish TLD
        return turkishTlds.some(tld => hostname.endsWith(tld));
    } catch (e) {
        console.error("Failed to parse URL for Turkish domain check:", (e as Error).message, url);
        return false;
    }
}

// Optional: Function to check if page content is in Turkish (performance-heavy, use sparingly)
async function isTurkishContent(url: string): Promise<boolean> {
    try {
        const { data, headers } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 5000
        });
        // Check Content-Language header
        const contentLanguage = headers['content-language']?.toLowerCase();
        if (contentLanguage && contentLanguage.includes('tr')) {
            return true;
        }
        // Check HTML lang attribute
        const $ = cheerio.load(data);
        const htmlLang = $('html').attr('lang')?.toLowerCase();
        return htmlLang === 'tr' || htmlLang === 'tr-tr';
    } catch (e) {
        console.error("Failed to check content language for URL:", (e as Error).message, url);
        return false;
    }
}

export async function fetchGoogleResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `google_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&hl=tr&gl=tr`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results: SearchResult[] = [];

        $('div.g').each((_, element) => {
            const linkElement = $(element).find('a[jsname][href]');
            let url = linkElement.attr('href');
            const title = $(element).find('h3').text()?.trim() || '';
            const snippetElement = $(element).find('div[data-sncf="1"]');
            const snippet = snippetElement.text()?.trim() || '';
            const displayUrl = $(element).find('cite').first().text()?.trim() || '';

            if (url && title && !url.startsWith('/search') && !url.startsWith('#')) {
                if (url.startsWith('/url?q=')) {
                    try {
                        const parsedUrl = new URLSearchParams(url.split('?')[1]);
                        url = parsedUrl.get('q') || url;
                    } catch (e) {
                        console.error("Failed to parse Google redirect URL:", (e as Error).message);
                    }
                }

                try {
                    const parsedUrl = new URL(url);
                    // Only include results with valid .tr domains
                    if (isTurkishDomain(url)) {
                        results.push({
                            title,
                            link: url,
                            snippet,
                            displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                            source: 'Google'
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse result URL for Google:", (e as Error).message, url);
                }
            }
        });

        const slicedResults = results.slice(0, 10);
        Cache.set(cacheKey, slicedResults);
        return slicedResults;
    } catch (error: any) {
        console.error('Google fetch error:', error.message);
        return [];
    }
}

export async function fetchBingResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const first = start + 1;
    const cacheKey = `bing_web_${first}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&setlang=tr&cc=tr`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results: SearchResult[] = [];

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
                    // Only include results with valid .tr domains
                    if (isTurkishDomain(url)) {
                        results.push({
                            title,
                            link: url,
                            snippet,
                            displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                            source: 'Bing'
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse result URL for Bing:", (e as Error).message, url);
                }
            }
        });

        const slicedResults = results.slice(0, 10);
        Cache.set(cacheKey, slicedResults);
        return slicedResults;
    } catch (error: any) {
        console.error('Bing fetch error:', error.message);
        return [];
    }
}

export async function fetchDuckDuckGoResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `duckduckgo_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${start}&kl=tr-tr&kp=-2`;
        const { data } = await axios.get<string>(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'tr-TR,tr;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const results: SearchResult[] = [];

        $('div.result').each((_, element) => {
            const titleElement = $(element).find('a.result__a');
            const title = titleElement.text().trim() || '';
            let url = titleElement.attr('href') || '';
            const snippet = $(element).find('div.result__snippet').text().trim() || '';
            const displayUrl = $(element).find('a.result__url').text().trim() || '';

            if (title && url) {
                if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
                    try {
                        const params = new URLSearchParams(url.split('?')[1]);
                        url = decodeURIComponent(params.get('uddg') || '');
                    } catch (e) {
                        console.error("Failed to parse DuckDuckGo redirect URL:", (e as Error).message, url);
                        return;
                    }
                }

                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                }

                try {
                    const parsedUrl = new URL(url);
                    // Only include results with valid .tr domains
                    if (isTurkishDomain(url)) {
                        results.push({
                            title,
                            link: url,
                            snippet,
                            displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                            source: 'DuckDuckGo'
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse result URL for DuckDuckGo:", (e as Error).message, url);
                }
            }
        });

        const slicedResults = results.slice(0, 10);
        Cache.set(cacheKey, slicedResults);
        return slicedResults;
    } catch (error: any) {
        console.error('DuckDuckGo fetch error:', error.message);
        return [];
    }
}

export async function fetchYandexResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `yandex_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://yandex.com.tr/search/?text=${encodeURIComponent(query)}&p=${Math.floor(start / 10)}&lr=113&lang=tr`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results: SearchResult[] = [];

        $('li.serp-item').each((_, element) => {
            const titleElement = $(element).find('h2 a');
            const title = titleElement.text().trim() || '';
            const url = titleElement.attr('href') || '';
            const snippet = $(element).find('div.organic__content-wrapper').text().trim() || '';
            const displayUrl = $(element).find('div.path a').text().trim() || '';

            if (title && url) {
                try {
                    const parsedUrl = new URL(url);
                    // Only include results with valid .tr domains
                    if (isTurkishDomain(url)) {
                        results.push({
                            title,
                            link: url,
                            snippet,
                            displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                            source: 'Yandex'
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse result URL for Yandex:", (e as Error).message, url);
                }
            }
        });

        const slicedResults = results.slice(0, 10);
        Cache.set(cacheKey, slicedResults);
        return slicedResults;
    } catch (error: any) {
        console.error('Yandex fetch error:', error.message);
        return [];
    }
}

export async function fetchEcosiaResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `ecosia_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const url = `https://www.ecosia.org/search?q=${encodeURIComponent(query)}&p=${Math.floor(start / 10)}`;
            const { data } = await axios.get<string>(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept-Language': 'tr-TR,tr;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Referer': 'https://www.ecosia.org/',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 12000
            });

            const $ = cheerio.load(data);
            const results: SearchResult[] = [];

            $('div.result').each((_, element) => {
                const titleElement = $(element).find('a.result-title');
                const title = titleElement.text().trim() || '';
                const url = titleElement.attr('href') || '';
                const snippet = $(element).find('p.result-snippet').text().trim() || '';
                const displayUrl = $(element).find('span.result-url').text().trim() || '';

                if (title && url) {
                    try {
                        const parsedUrl = new URL(url);
                        // Only include results with valid .tr domains
                        if (isTurkishDomain(url)) {
                            results.push({
                                title,
                                link: url,
                                snippet,
                                displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                                source: 'Ecosia'
                            });
                        }
                    } catch (e) {
                        console.error("Failed to parse result URL for Ecosia:", (e as Error).message, url);
                    }
                }
            });

            const slicedResults = results.slice(0, 10);
            Cache.set(cacheKey, slicedResults);
            return slicedResults;
        } catch (error: any) {
            console.error(`Ecosia fetch error (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
            if (error.response?.status === 403 && attempt < maxRetries) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            return [];
        }
    }

    return [];
}

export async function fetchTwitterResults(query: string): Promise<SearchResult[]> {
    const cacheKey = `twitter_web_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://x.com/search?q=${encodeURIComponent(query)}&lang=tr`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results: SearchResult[] = [];

        $('article').each((_, element) => {
            const tweetElement = $(element).find('div[lang]');
            const snippet = tweetElement.text().trim() || '';
            const linkElement = $(element).find('a[href*="/status/"]');
            const link = `https://x.com${linkElement.attr('href') || ''}`;
            const title = snippet.length > 50 ? `${snippet.substring(0, 47)}...` : snippet;
            const username = $(element).find('a[role="link"]').first().text().trim() || 'X Kullanıcısı';

            if (snippet && link) {
                // Optionally filter Twitter results to only include links to .tr domains
                // Remove this check to allow all Twitter posts
                if (isTurkishDomain(link)) {
                    results.push({
                        title,
                        link,
                        snippet,
                        displayUrl: username,
                        source: 'X'
                    });
                }
            }
        });

        const slicedResults = results.slice(0, 10);
        Cache.set(cacheKey, slicedResults);
        return slicedResults;
    } catch (error: any) {
        console.error('Twitter/X fetch error:', error.message);
        return [];
    }
}

export async function getAggregatedWebResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `aggregated_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const [googleResults, bingResults, duckDuckGoResults, yandexResults, ecosiaResults, twitterResults] = await Promise.all([
            fetchGoogleResults(query, start),
            fetchBingResults(query, start),
            fetchDuckDuckGoResults(query, start),
            fetchYandexResults(query, start),
            fetchEcosiaResults(query, start),
            fetchTwitterResults(query)
        ]);

        const resultsMap = new Map<string, SearchResult>();

        [googleResults, bingResults, duckDuckGoResults, yandexResults, ecosiaResults, twitterResults].forEach(results => {
            results.forEach(item => {
                // Only include results with valid .tr domains
                // Remove '|| item.source === 'X'' to exclude Twitter unless it links to .tr domains
                if (isTurkishDomain(item.link)) {
                    if (!resultsMap.has(item.link)) {
                        resultsMap.set(item.link, item);
                    }
                }
            });
        });

        const combined = Array.from(resultsMap.values());
        const slicedCombined = combined.slice(0, 10);
        Cache.set(cacheKey, slicedCombined);
        return slicedCombined;

    } catch (error: any) {
        console.error('Aggregated search error:', error.message);
        return [];
    }
}

// Include other unchanged functions here (omitted for brevity):
// - fetchWikiSummary
// - fetchGoogleNewsResults
// - fetchYahooNewsResults
// - fetchBingImages
// - fetchGoogleImages
// - fetchDuckDuckGoImages
// - fetchYoutubeResults
// - fetchVimeoResults
// - getAggregatedImageResults
// - getAggregatedVideoResults
// - getAggregatedNewsResults
// - checkBangRedirects