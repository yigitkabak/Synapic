import { Express, Request, Response, NextFunction } from 'express';
import axios, { isAxiosError } from 'axios';
import validApiKeys from '../views/json/ApiKeys.json';
import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';

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

interface WikiSummary {
    title: string;
    summary: string;
    img: string | null;
    url: string;
}

interface SearchResult {
    title: string;
    snippet: string;
    displayUrl: string;
    link: string;
    source: string;
}

interface ImageResult {
    image: string;
    thumbnail: string | null;
    title: string;
    link: string;
}

interface VideoResult {
    title: string;
    url: string;
    thumbnail: string;
    source: string;
}

interface CacheItem<T> {
    data: T | null;
    expiry: number;
}

interface IPInfoData {
    country: string;
}

interface RenderData {
    query: string;
    type: string;
    start: number;
    results: SearchResult[];
    images: ImageResult[];
    videos: VideoResult[];
    newsResults: [];
    wiki: WikiSummary | null;
    countryCode: string;
    elapsedTime: string;
    searchSource: string;
    messageSent?: boolean;
}

interface ApiResponse {
    query: string;
    type: string;
    searchSource: string;
    wiki: WikiSummary | null;
    results?: SearchResult[];
    images?: ImageResult[];
    videos?: VideoResult[];
    newsResults?: [];
    error?: string;
}

const cacheStorage = new Map<string, CacheItem<any>>();
const cacheExpiration = 15 * 60 * 1000; // Cache süresi 15 dakika

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
    getStorage: function(): Map<string, CacheItem<any>> {
        return cacheStorage;
    }
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SEARX_BASE_URL = 'https://searx.be';

export async function fetchWikiSummary(query: string, lang: string = 'tr'): Promise<WikiSummary | null> {
    const cacheKey = `wiki_summary_${lang}_${query}`;
    const cachedData = Cache.get<WikiSummary>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get<WikipediaSummaryApiResponse>(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        if (data && data.title && data.extract) {
            const summary: WikiSummary = {
                title: data.title,
                summary: data.extract,
                img: data.thumbnail?.source || null,
                url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`
            };
            Cache.set(cacheKey, summary);
            return summary;
        }

        Cache.set(cacheKey, null);
        return null;
    } catch (error: any) {
        if (isAxiosError(error) && error.response?.status === 404) {
        } else {
            console.error(`WikiSummary (${lang}) getirme hatası (${query}):`, error.message);
        }
        Cache.set(cacheKey, null);
        return null;
    }
}

export async function fetchBingImages(query: string): Promise<ImageResult[]> {
    const cacheKey = `bing_images_${query}`;
    const cachedData = Cache.get<ImageResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&tsc=ImageHoverTitle`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const images: ImageResult[] = [];
        $('a.iusc').each((_, el) => {
            const item = $(el);
            const m_attr = item.attr('m');
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
                } catch (e: any) {
                    console.error("Bing görsel JSON ayrıştırma hatası: ", e.message);
                }
            }
        });
        if (images.length > 0) Cache.set(cacheKey, images);
        else Cache.set(cacheKey, []);
        return images;
    } catch (error: any) {
        console.error('Bing Images getirme hatası:', error.message);
        Cache.set(cacheKey, []);
        return [];
    }
}

export async function fetchYoutubeResults(query: string): Promise<VideoResult[]> {
    const cacheKey = `youtube_videos_${query}`;
    const cachedData = Cache.get<VideoResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
         const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=tr`;
         const { data } = await axios.get<string>(url, {
             headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7' },
             timeout: 10000
         });

        const videos: VideoResult[] = [];
        const regex = /var ytInitialData = ({.*?});<\/script>/s;
        const match = data.match(regex);

        if (match && match[1]) {
            try {
                const ytData = JSON.parse(match[1]);
                const contents = ytData.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

                if (contents) {
                    for (const item of contents) {
                        if (item.videoRenderer) {
                            const vr = item.videoRenderer;
                            const videoUrl = `https://www.youtube.com/watch?v=${vr.videoId}`;

                            videos.push({
                                title: vr.title?.runs?.[0]?.text || 'Başlık Yok',
                                url: videoUrl,
                                thumbnail: vr.thumbnail?.thumbnails?.[0]?.url || '',
                                source: vr.ownerText?.runs?.[0]?.text || 'YouTube'
                            });
                        }
                        if (videos.length >= 10) break;
                    }
                } else {
                     console.warn("Youtube results structure not found for query:", query);
                }
            } catch (e: any) {
                console.error("YouTube JSON verisi ayrıştırma hatası: ", e.message);
            }
        } else {
            console.warn("YouTube initial data not found for query:", query);
        }

        if (videos.length > 0) Cache.set(cacheKey, videos);
        else Cache.set(cacheKey, []);
        return videos;
    } catch (error: any) {
        console.error('YouTube getirme hatası:', error.message);
        Cache.set(cacheKey, []);
        return [];
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
             let resultUrl = linkElement.attr('href');
             const title = $(element).find('h3').first().text()?.trim() || '';
             const snippetElement = $(element).find('div[data-sncf="1"]').first();
             const snippet = snippetElement.text()?.trim() || '';
             const displayUrl = $(element).find('cite').first().text()?.trim() || '';
             if (resultUrl && title && !resultUrl.startsWith('/search') && !resultUrl.startsWith('#')) {
                 if (resultUrl.startsWith('/url?q=')) {
                     try {
                         const parsedUrlParams = new URLSearchParams(resultUrl.split('?')[1]);
                         const decodedUrl = parsedUrlParams.get('q') || resultUrl;
                         resultUrl = decodedUrl;
                     } catch (e: any) {
                         console.error("Google yönlendirme URL'si ayrıştırılamadı:", e.message);
                     }
                 }
                 try {
                     const parsedResultUrl = new URL(resultUrl as string);
                     results.push({
                         title, link: resultUrl as string, snippet,
                         displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                         source: 'Google'
                     });
                 } catch (e: any) {
                 }
             }
         });
         if (results.length > 0) Cache.set(cacheKey, results);
         else Cache.set(cacheKey, []);
         return results;
     } catch (error: any) {
         console.error('Google getirme hatası:', error.message);
         Cache.set(cacheKey, []);
         return [];
     }
}

export async function fetchBingResults(query: string, start: number = 0): Promise<SearchResult[]> {
     const first = start + 1;
     const cacheKey = `bing_web_${first}_${query}`;
     const cachedData = Cache.get<SearchResult[]>(cacheKey);
     if (cachedData) return cachedData;
     try {
         const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&setlang=tr&cc=TR`;
         const { data } = await axios.get<string>(url, {
             headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
             timeout: 7000
         });
         const $ = cheerio.load(data);
         const results: SearchResult[] = [];
         $('li.b_algo').each((_, element) => {
             const titleNode = $(element).find('h2 a');
             const title = titleNode.text().trim() || '';
             const resultUrl = titleNode.attr('href') || '';
             const snippetNode = $(element).find('.b_caption p');
             let snippet = snippetNode.text().trim();
             if (!snippet) {
                 snippet = $(element).find('div.b_caption div.b_snippet').text().trim();
                  if (!snippet) {
                     snippet = $(element).find('p').first().text().trim();
                  }
             }
             const displayUrl = $(element).find('cite').text().trim() || '';
             if (title && resultUrl) {
                 try {
                     const parsedResultUrl = new URL(resultUrl);
                     results.push({
                         title, link: resultUrl, snippet: snippet || 'Özet bulunamadı.',
                         displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                         source: 'Bing'
                     });
                 } catch (e: any) {
                 }
             }
         });
         if (results.length > 0) Cache.set(cacheKey, results);
         else Cache.set(cacheKey, []);
         return results;
     } catch (error: any) {
         console.error('Bing getirme hatası:', error.message);
         Cache.set(cacheKey, []);
         return [];
     }
}

export async function fetchDuckDuckGoResults(query: string, start: number = 0): Promise<SearchResult[]> {
     const ddgStart = Math.floor(start / 10) * 20;
     const cacheKey = `duckduckgo_web_${ddgStart}_${query}`;
     const cachedData = Cache.get<SearchResult[]>(cacheKey);
     if (cachedData) return cachedData;

     try {
         const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${ddgStart}&kl=tr-tr&df=`;
         const { data } = await axios.get<string>(url, {
             headers: {
                 'User-Agent': USER_AGENT,
                 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                 'Accept-Language': 'tr-TR,tr;q=0.8,en-US;q=0.5,en;q=0.3',
                 'Referer': 'https://duckduckgo.com/'
             },
             timeout: 10000
         });

         const $ = cheerio.load(data);
         const results: SearchResult[] = [];

         $('div.web-result').each((_, element) => {
             const titleElement = $(element).find('h2 a.result__a, a.L4EwT6U8e1Y9j49_MIH8');
             const title = titleElement.text().trim() || '';
             let resultUrl = titleElement.attr('href') || '';

             const snippetElement = $(element).find('a.result__snippet, .result__snippet, span.OgdwYG6KE2q5lMyNJA_L');
             const snippet = snippetElement.text().trim() || '';

             const displayUrlElement = $(element).find('a.result__url');
             let displayUrl = displayUrlElement.text().trim().replace(/^https\?:\/\//, '').replace(/^http\?:\/\//, '');

             if (title && resultUrl) {
                 if (resultUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
                     try {
                         const params = new URLSearchParams(resultUrl.split('?')[1]);
                         const decodedUrl = decodeURIComponent(params.get('uddg') || '');
                         if (decodedUrl) resultUrl = decodedUrl;
                     } catch (e: any) {
                         console.error("DuckDuckGo yönlendirme URL'si ayrıştırılamadı:", e.message, resultUrl);
                     }
                 }

                 if (!resultUrl.startsWith('http://') && !resultUrl.startsWith('https://')) {
                     if (resultUrl.startsWith('//')) {
                         resultUrl = `https:${resultUrl}`;
                     } else {
                         return;
                     }
                 }

                 try {
                     const parsedResultUrl = new URL(resultUrl);
                     if (!displayUrl) {
                          displayUrl = parsedResultUrl.hostname.replace(/^www\./, '');
                     }

                     results.push({
                         title,
                         link: resultUrl,
                         snippet,
                         displayUrl,
                         source: 'DuckDuckGo'
                     });
                 } catch (e: any) {
                     console.error("DuckDuckGo sonuç URL'si oluşturulamadı:", e.message, resultUrl);
                 }
             }
         });

         if (results.length > 0) Cache.set(cacheKey, results);
         else Cache.set(cacheKey, []);

         return results;
     } catch (error: any) {
         console.error('DuckDuckGo getirme hatası:', error.message);
         Cache.set(cacheKey, []);
         return [];
     }
}


// Modified fetchSearxResults to fetch a fixed number of pages from page 0
export async function fetchSearxResults(query: string, numPages: number = 10): Promise<SearchResult[]> {
    if (!SEARX_BASE_URL) {
        console.error("SEARX_BASE_URL is not configured.");
        return [];
    }

    const cacheKey = `searx_web_html_pages_0_to_${numPages - 1}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    const allSearxResults: SearchResult[] = [];
    const fetchedUrls = new Set<string>();

    console.log(`Workspaceing ${numPages} Searx pages (0 to ${numPages - 1}) for query "${query}"`);

    for (let page = 0; page < numPages; page++) {
        try {
            const url = `${SEARX_BASE_URL}/search?q=${encodeURIComponent(query)}&p=${page}&lng=tr-TR`;

            const { data } = await axios.get<string>(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
                    'Referer': SEARX_BASE_URL
                },
                timeout: 15000
            });

            const $ = cheerio.load(data);

            const resultSelector = '.result';
            const titleSelector = '.result-title a';
            const snippetSelector = '.result-content .result-snippet';
            const urlSelector = '.result-url';

            $(resultSelector).each((_, element) => {
                const titleElement = $(element).find(titleSelector);
                const title = titleElement.text().trim() || '';
                let resultUrl = titleElement.attr('href') || '';

                const snippet = $(element).find(snippetSelector).text().trim() || '';
                const displayUrl = $(element).find(urlSelector).text().trim() || '';

                if (resultUrl.startsWith('/url?')) {
                     try {
                         const absoluteUrl = new URL(resultUrl, SEARX_BASE_URL).toString();
                         const parsedUrl = new URL(absoluteUrl);
                          const realUrlParam = parsedUrl.searchParams.get('q');
                         if (realUrlParam) {
                              resultUrl = realUrlParam;
                         } else {
                             resultUrl = absoluteUrl;
                         }
                     } catch (e: any) {
                         console.error("Searx yönlendirme URL'si ayrıştırılamadı:", e.message, resultUrl);
                         resultUrl = '';
                     }
                } else if (resultUrl.startsWith('/')) {
                     resultUrl = new URL(resultUrl, SEARX_BASE_URL).toString();
                }


                if (title && resultUrl && resultUrl !== '#' && !fetchedUrls.has(resultUrl)) {
                    try {
                        const parsedResultUrl = new URL(resultUrl);
                        allSearxResults.push({
                            title,
                            link: resultUrl,
                            snippet: snippet || 'Özet bulunamadı.',
                            displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                            source: 'Searx'
                        });
                        fetchedUrls.add(resultUrl);
                    } catch (e: any) {
                        console.error("Searx sonuç URL'si oluşturulamadı:", e.message, resultUrl);
                    }
                }
            });

        } catch (error: any) {
             console.error(`Searx sayfa ${page} getirme hatası (${query}):`, error.message);
             if (isAxiosError(error) && error.response) {
                console.error('Searx Hata Detayı:', error.response.status, error.response.data);
             }
             // Continue fetching other pages even if one fails
        }
    }

    if (allSearxResults.length > 0) Cache.set(cacheKey, allSearxResults);
     else if (allSearxResults.length === 0 && numPages > 0) Cache.set(cacheKey, []); // Cache empty if no results from all pages
    else Cache.set(cacheKey, []);


    return allSearxResults;
}

function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Modified getAggregatedWebResults to fetch a larger pool and paginate from it
export async function getAggregatedWebResults(query: string, start: number = 0): Promise<SearchResult[]> {
    // Cache key for the full combined list (independent of 'start')
    const FULL_LIST_CACHE_KEY = `full_aggregated_bing_50_ddg_60_searx_pages_10_web_${query}`;
    const cachedFullList = Cache.get<SearchResult[]>(FULL_LIST_CACHE_KEY);

    let fullCombinedList: SearchResult[] = [];

    if (cachedFullList) {
        fullCombinedList = cachedFullList;
        console.log(`Cache hit for full aggregated list for query "${query}"`);
    } else {
        console.log(`Cache miss for full aggregated list for query "${query}". Fetching...`);
        try {
            const MAX_BING_RESULTS = 50; // Fetch first 50 from Bing
            const MAX_DDG_RESULTS = 60; // Fetch first 60 from DuckDuckGo (DDG steps by ~20)
            const MAX_SEARX_PAGES = 10; // Fetch first 10 pages from Searx

            const fetchPromises: Promise<SearchResult[]>[] = [];

            // Fetch from Bing (0, 10, 20, 30, 40)
            for (let i = 0; i < MAX_BING_RESULTS / 10; i++) {
                fetchPromises.push(fetchBingResults(query, i * 10).catch(e => { console.error(`Bing fetch failed (start=${i*10}):`, e.message); return []; }));
            }

            // Fetch from DuckDuckGo (0, 20, 40)
            for (let i = 0; i < MAX_DDG_RESULTS / 20; i++) {
                 fetchPromises.push(fetchDuckDuckGoResults(query, i * 20).catch(e => { console.error(`DDG fetch failed (start=${i*20}):`, e.message); return []; }));
            }

            // Fetch from Searx (pages 0 to MAX_SEARX_PAGES-1)
             fetchPromises.push(fetchSearxResults(query, MAX_SEARX_PAGES).catch(e => { console.error(`Searx fetch failed (${MAX_SEARX_PAGES} pages):`, e.message); return []; }));


            const allFetchedResults = await Promise.all(fetchPromises);

            // Combine and deduplicate all results from all sources
            const resultsMap = new Map<string, SearchResult>();

             allFetchedResults.flat().forEach(item => {
                 if (item?.link && !resultsMap.has(item.link)) {
                     resultsMap.set(item.link, item);
                 } else if (item?.link) {
                      // console.log("Duplicate found:", item.link); // Optional: log duplicates
                 }
             });


            fullCombinedList = Array.from(resultsMap.values());

            // Shuffle the combined results once
            fullCombinedList = shuffleArray(fullCombinedList);

            // Cache the full combined and shuffled list
            if (fullCombinedList.length > 0) {
                 Cache.set(FULL_LIST_CACHE_KEY, fullCombinedList);
                 console.log(`Cached full aggregated list (${fullCombinedList.length} items) for query "${query}"`);
            } else {
                 Cache.set(FULL_LIST_CACHE_KEY, []);
                 console.log(`No results for full aggregated list for query "${query}". Caching empty.`);
            }


        } catch (error: any) {
            console.error('Error fetching or processing full aggregated list:', error.message);
            Cache.set(FULL_LIST_CACHE_KEY, []); // Cache empty on error
            fullCombinedList = [];
        }
    }

    // Now paginate from the full combined list using the requested 'start' offset
    const slicedResults = fullCombinedList.slice(start, start + 10);

    console.log(`Returning sliced results (start=${start}, count=${slicedResults.length}) from full list (${fullCombinedList.length} items)`);

    // Note: We don't cache the slice here, only the full list is cached.
    // The UI's pagination links will simply update the 'start' parameter.

    return slicedResults;
}

export function checkBangRedirects(query: string): string | null {
    const bangs: { [key: string]: string } = {
        '!g': 'https://www.google.com/search?q=',
        '!w': 'https://tr.wikipedia.org/wiki/Special:Search?search=',
        '!bing': 'https://www.bing.com/search?q=',
        '!ddg': 'https://duckduckgo.com/?q=',
        '!amazon': 'https://www.amazon.com.tr/s?k=',
    };
    const parts = query.split(' ');
    const bang = parts[0].toLowerCase();
    if (bangs[bang]) {
        const searchQuery = parts.slice(1).join(' ');
        return `${bangs[bang]}${encodeURIComponent(searchQuery)}`;
    }
    return null;
}

export function checkApiKey(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.query.apikey as string | undefined;
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        res.status(403).json({ error: "Geçersiz veya eksik API anahtarı" });
        return;
    }
    next();
}

export function setupRoutes(app: Express, ipinfoToken: string | undefined): void {
    app.get('/search', async (req: Request, res: Response) => {
        const startTime = Date.now();
        const query = (req.query.query as string || req.query.q as string || '').trim();
        let type = (req.query.type as string || 'web').toLowerCase();
        const start = Math.max(0, parseInt(req.query.start as string) || 0);

        if (!query) {
            res.redirect('/');
            return;
        }

        const bangRedirect = checkBangRedirects(query);
        if (bangRedirect) {
            res.redirect(bangRedirect);
            return;
        }

        let countryCode = 'N/A';
        if (ipinfoToken) {
            try {
                 const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || '8.8.8.8';
                 const ipCacheKey = `ipinfo_${ip}`;
                 let geoData = Cache.get<IPInfoData>(ipCacheKey);

                 if (!geoData) {
                     const response = await axios.get<IPInfoData>(`https://ipinfo.io/${ip}?token=${ipinfoToken}`, { timeout: 1500 });
                     geoData = response.data;
                     Cache.set(ipCacheKey, geoData);
                 }
                 countryCode = geoData?.country || 'N/A';

            } catch (error: any) {
                 console.error("IP Info fetch error:", error.message);
            }
        }

        const renderData: RenderData = {
            query, type, start, results: [], images: [], newsResults: [],
            videos: [], wiki: null, countryCode, elapsedTime: '0.00',
            searchSource: 'Synapic Search'
        };

        try {
            const fetchPromises: Promise<any>[] = [];
            let searchSourceText = 'Sonuçlar';

            const webLikeTypesForWiki = ['web', 'wiki'];
            if (webLikeTypesForWiki.includes(type)) {
                 fetchPromises.push(fetchWikiSummary(query, 'tr')
                     .catch((e: Error) => { console.error("Wiki fetch failed inline:", e.message); return null; }));
             } else {
                 fetchPromises.push(Promise.resolve(null));
             }


            let mainFetchPromise: Promise<any[]>;

            switch (type) {
                case 'web':
                    // getAggregatedWebResults now handles fetching multiple initial pages and slicing
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    searchSourceText = 'Web Sonuçları (Birleşik)';
                    break;
                 case 'image':
                     mainFetchPromise = fetchBingImages(query);
                     searchSourceText = 'Görsel Sonuçları (Bing)';
                     break;
                case 'wiki':
                    mainFetchPromise = Promise.resolve([]); // Wiki result is fetched in the wikiPromise
                    searchSourceText = 'Wikipedia Sonucu';
                    break;
                 case 'video':
                     mainFetchPromise = fetchYoutubeResults(query);
                     searchSourceText = 'Video Sonuçları (YouTube)';
                     break;
                default:
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    renderData.type = 'web';
                    type = 'web';
                    searchSourceText = 'Web Sonuçları (Birleşik - Varsayılan)';
            }

            renderData.searchSource = searchSourceText;

             // Add the main fetch promise *after* it's defined in the switch
             fetchPromises.push(mainFetchPromise.catch((e: Error) => {
                 console.error(`${type} fetch failed inline:`, e.message);
                 // Return empty array for results/images/videos, null for wiki if that was main fetch
                 return (type === 'wiki') ? null : [];
              }));


            // Wait for all fetches
            const [wikiResult, mainResults] = await Promise.all(fetchPromises);

            renderData.wiki = wikiResult as WikiSummary | null;

            // Assign mainResults based on type
            switch (type) {
                 case 'web':
                     renderData.results = mainResults as SearchResult[] || [];
                     break;
                 case 'image':
                     renderData.images = mainResults as ImageResult[] || [];
                     break;
                 case 'video':
                     renderData.videos = mainResults as VideoResult[] || [];
                     break;
                case 'wiki':
                     // Wiki result is already in renderData.wiki
                     renderData.results = []; // Ensure results array is empty for wiki type
                     break;
                default:
                     renderData.results = mainResults as SearchResult[] || [];
                     break;
             }


        } catch (error: any) {
            console.error("Error during search processing:", error.message);
            renderData.searchSource = `Sonuçlar alınırken hata oluştu`;
             // Ensure relevant result array is empty on error if not already
             if (type === 'web') renderData.results = [];
             else if (type === 'image') renderData.images = [];
             else if (type === 'video') renderData.videos = [];
             // wiki might still be null from the fetch
        } finally {
            renderData.elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            res.render('results', renderData);
        }
    });

    app.get('/api/search', checkApiKey, async (req: Request, res: Response) => {
         const query = (req.query.query as string || req.query.q as string)?.trim();
         let type = (req.query.type as string || 'web').toLowerCase();
         const start = Math.max(0, parseInt(req.query.start as string) || 0);

         if (!query) {
             res.status(400).json({ error: "Arama sorgusu eksik!" });
             return;
         }

         try {
            let searchSourceApi: string = 'API Sonuçları';

            const webLikeTypesForWikiApi = ['web', 'wiki'];
            const wikiPromise = webLikeTypesForWikiApi.includes(type) ?
                fetchWikiSummary(query, 'tr')
                .catch((e: Error) => { console.error("API Wiki fetch failed:", e.message); return null; })
                : Promise.resolve(null);

            let mainFetchPromise: Promise<any[] | WikiSummary | null>; // Can be array or wiki summary

            switch (type) {
                case 'web':
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    searchSourceApi = 'Birleşik Web (API)';
                    break;
                 case 'image':
                     mainFetchPromise = fetchBingImages(query);
                     searchSourceApi = 'Bing Görselleri (API)';
                     break;
                case 'wiki':
                    mainFetchPromise = fetchWikiSummary(query, 'tr'); // Wiki is the main result for wiki type
                    searchSourceApi = 'Wikipedia (API)';
                    break;
                 case 'video':
                     mainFetchPromise = fetchYoutubeResults(query);
                     searchSourceApi = 'YouTube Videoları (API)';
                     break;
                default:
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    type = 'web';
                    searchSourceApi = 'Birleşik Web (API - Varsayılan)';
            }

            // For wiki type, wikiPromise and mainFetchPromise are the same.
            // For other types, wikiPromise is only fetched if type is web-like,
            // and mainFetchPromise fetches the primary results type.
            const [wikiResultForOtherTypes, mainResult] = await Promise.all([
                 (type !== 'wiki' && webLikeTypesForWikiApi.includes(type)) ? wikiPromise : Promise.resolve(null),
                 mainFetchPromise
            ]);

            const apiResponse: ApiResponse = {
                query, type, searchSource: searchSourceApi,
                 wiki: type === 'wiki' ? mainResult as WikiSummary | null : wikiResultForOtherTypes as WikiSummary | null,
            };

            switch (type) {
                case 'web':
                    apiResponse.results = mainResult as SearchResult[] || [];
                    break;
                 case 'image':
                    apiResponse.images = mainResult as ImageResult[] || [];
                    break;
                 case 'video':
                    apiResponse.videos = mainResult as VideoResult[] || [];
                    break;
                case 'wiki':
                    // Wiki result is already in apiResponse.wiki
                    break;
                default:
                    apiResponse.results = mainResult as SearchResult[] || [];
                    break;
            }

            res.json(apiResponse);
         } catch (error: any) {
            console.error("API Search Error:", error.message);
            res.status(500).json({ error: "Arama sırasında bir sunucu hatası oluştu." });
         }
    });

    app.get('/', (req: Request, res: Response) => res.render('index'));
    app.get('/manifesto', (req: Request, res: Response) => res.render('manifesto'));
    app.get('/iletisim', (req: Request, res: Response) => res.render('iletisim', { messageSent: false }));

    app.get('/image', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=image`);
    });
     app.get('/wiki', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=wiki`);
    });
     app.get('/video', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=video`);
    });
    app.get('/search', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
         const type = req.query.type as string || 'web';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`);
    });

}
