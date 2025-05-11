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
    image?: string;
    date?: string;
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

interface NewsArticle {
    title: string;
    description: string;
    content: string;
    url: string;
    image?: string;
    publishedAt: string;
    source: {
        name: string;
        url: string;
    };
}

interface GNewsApiResponse {
    totalArticles: number;
    articles: NewsArticle[];
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
    newsResults: SearchResult[];
    wiki: WikiSummary | null;
    countryCode: string;
    elapsedTime: string;
    searchSource: string;
    messageSent?: boolean;
    errorMessage?: string;
}

interface ApiResponse {
    query: string;
    type: string;
    searchSource: string;
    wiki: WikiSummary | null;
    results?: SearchResult[];
    images?: ImageResult[];
    videos?: VideoResult[];
    newsResults?: SearchResult[];
    error?: string;
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
    getStorage: function(): Map<string, CacheItem<any>> {
        return cacheStorage;
    }
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SEARX_BASE_URL = 'https://searx.be';

const GNEWS_API_KEY = 'eaa76e708952a1df00eae28a4b2d3654';
const GNEWS_BASE_URL = 'https://gnews.io/api/v4/search';


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
         const youtubeSearchUrl = `https://www.youtube.com/results?search_query=$${encodeURIComponent(query)}&hl=tr`;

         const { data } = await axios.get<string>(youtubeSearchUrl, {
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
                            const videoUrl = `https://www.youtube.com/watch?v=$${vr.videoId}`;

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
                     console.warn("Youtube initial data structure not found for query:", query);
                }
            } catch (e: any) {
                console.error("YouTube JSON verisi ayrıştırma hatası: ", e.message);
            }
        } else {
            console.warn("YouTube initial data not found for query:", query);
             const $ = cheerio.load(data);
             $('ytd-video-renderer').each((_, el) => {
                 const titleElement = $(el).find('h3 a#video-title');
                 const videoId = titleElement.attr('href')?.replace('/watch?v=', '');
                 const title = titleElement.text().trim();
                 const thumbnailUrl = $(el).find('img#img').attr('src');
                 const ownerText = $(el).find('yt-formatted-string#owner-text a').text().trim();

                 if (videoId && title && thumbnailUrl) {
                     videos.push({
                         title,
                         url: `https://www.youtube.com/watch?v=$${videoId}`,
                         thumbnail: thumbnailUrl,
                         source: ownerText || 'YouTube'
                     });
                 }
                 if (videos.length >= 10) return false;
             });
             if (videos.length === 0) {
                  console.warn("Basic YouTube scraping also failed for query:", query);
             }
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
                     snippet = $(element).find('.b_caption p').text().trim();
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

         const resultSelector = 'div.web-result';
         const titleSelector = 'h2 a.result__a, a.L4EwT6U8e1Y9j49_MIH8';
         const snippetSelector = 'a.result__snippet, .result__snippet, span.OgdwYG6KE2q5lMyNJA_L';
         const urlSelector = 'a.result__url';

         $(resultSelector).each((_, element) => {
             const titleElement = $(element).find(titleSelector);
             const title = titleElement.text().trim() || '';
             let resultUrl = titleElement.attr('href') || '';

             const snippetElement = $(element).find(snippetSelector);
             const snippet = snippetElement.text().trim() || '';

             const displayUrlElement = $(element).find(urlSelector);
             let displayUrl = displayUrlElement.text().trim().replace(/^https?:\/\//, '').replace(/^http?:\/\//, '');

             if (title && resultUrl) {
                 if (resultUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
                     try {
                         const params = new URLSearchParams(resultUrl.split('?')[1]);
                         const decodedUrl = decodeURIComponent(params.get('uddg') || '');
                         if (decodedUrl) resultUrl = decodedUrl;
                     } catch (e: any) {
                         console.error("DuckDuckGo yönlendirme URL'si ayrıştırılamadı:", e.message, resultUrl);
                     }
                 } else if (resultUrl.startsWith('/')) {
                     resultUrl = new URL(resultUrl, 'https://duckduckgo.com').toString();
                 }


                 if (!resultUrl.startsWith('http://') && !resultUrl.startsWith('https://')) {
                      console.warn("Skipping non-http/https DDG result:", resultUrl);
                      return;
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
        }
    }

    if (allSearxResults.length > 0) Cache.set(cacheKey, allSearxResults);
     else if (allSearxResults.length === 0 && numPages > 0) Cache.set(cacheKey, []);
    else Cache.set(cacheKey, []);


    return allSearxResults;
}

export async function fetchNewsResults(query: string): Promise<SearchResult[]> {
    const cacheKey = `news_results_tr_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `${GNEWS_BASE_URL}?q=${encodeURIComponent(query)}&lang=tr&country=tr&max=10&apikey=${GNEWS_API_KEY}`;
        const { data } = await axios.get<GNewsApiResponse>(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 7000
        });

        if (data && data.articles) {
            const newsResults: SearchResult[] = data.articles.map(article => {
                let displayUrl = article.url;
                 try {
                     const parsedUrl = new URL(article.url);
                     displayUrl = parsedUrl.hostname.replace(/^www\./, '');
                 } catch (e) {
                     console.error("News URL parsing error:", e);
                 }

                return {
                    title: article.title,
                    snippet: article.description || 'Özet bulunamadı.',
                    link: article.url,
                    displayUrl: displayUrl,
                    source: article.source?.name || 'Haber Kaynağı',
                    image: article.image,
                    date: article.publishedAt
                };
            });
            if (newsResults.length > 0) Cache.set(cacheKey, newsResults);
            else Cache.set(cacheKey, []);
            return newsResults;
        }

        Cache.set(cacheKey, []);
        return [];
    } catch (error: any) {
        console.error('News getirme hatası (gnews.io):', error.message);
        if (isAxiosError(error) && error.response) {
            console.error('News Hata Detayı:', error.response.status, error.response.data);
        }
        Cache.set(cacheKey, []);
        return [];
    }
}


function containsExcludedScripts(text: string): boolean {
    if (!text) return false;
    for (let i = 0; i < text.length; i++) {
        const codePoint = text.codePointAt(i)!;

        if (codePoint >= 0x0600 && codePoint <= 0x06FF) return true;
        if (codePoint >= 0x0750 && codePoint <= 0x077F) return true;
        if (codePoint >= 0x08A0 && codePoint <= 0x08FF) return true;
        if (codePoint >= 0xFB50 && codePoint <= 0xFDFF) return true;
        if (codePoint >= 0xFE70 && codePoint <= 0xFEFF) return true;

        if (codePoint >= 0x4E00 && codePoint <= 0x9FFF) return true;
        if (codePoint >= 0x3400 && codePoint <= 0x4DBF) return true;
        if (codePoint >= 0x20000 && codePoint <= 0x2A6DF) return true;
        if (codePoint >= 0x2A700 && codePoint <= 0x2B73F) return true;
        if (codePoint >= 0x2B740 && codePoint <= 0x2B81F) return true;
        if (codePoint >= 0x2B820 && codePoint <= 0x2CEAF) return true;
        if (codePoint >= 0x2CEB0 && codePoint <= 0x2EBEF) return true;
         if (codePoint >= 0x30000 && codePoint <= 0x3134F) return true;
         if (codePoint >= 0x31350 && codePoint <= 0x323AF) return true;


        if (codePoint >= 0x3040 && codePoint <= 0x309F) return true;
        if (codePoint >= 0x30A0 && codePoint <= 0x30FF) return true;
        if (codePoint >= 0x31F0 && codePoint <= 0x31FF) return true;
        if (codePoint >= 0xFF00 && codePoint <= 0xFFEF) return true;

        if (codePoint >= 0x1100 && codePoint <= 0x11FF) return true;
        if (codePoint >= 0x3130 && codePoint <= 0x318F) return true;
        if (codePoint >= 0xA960 && codePoint <= 0xA97F) return true;
        if (codePoint >= 0xAC00 && codePoint <= 0xD7A3) return true;
        if (codePoint >= 0xD7B0 && codePoint <= 0xD7FF) return true;
    }
    return false;
}


export async function getAggregatedWebResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const FULL_LIST_CACHE_KEY = `full_aggregated_bing_50_ddg_60_searx_pages_10_web_${query}`;
    const cachedFullList = Cache.get<SearchResult[]>(FULL_LIST_CACHE_KEY);

    let fullCombinedList: SearchResult[] = [];

    if (cachedFullList) {
        fullCombinedList = cachedFullList;
        console.log(`Cache hit for full aggregated list for query "${query}"`);
    } else {
        console.log(`Cache miss for full aggregated list for query "${query}". Fetching...`);
        try {
            const MAX_BING_RESULTS = 50;
            const MAX_DDG_RESULTS = 60;
            const MAX_SEARX_PAGES = 10;

            const fetchPromises: Promise<SearchResult[]>[] = [];

            for (let i = 0; i < MAX_BING_RESULTS / 10; i++) {
                fetchPromises.push(fetchBingResults(query, i * 10).catch(e => { console.error(`Bing fetch failed (start=${i*10}):`, e.message); return []; }));
            }

            for (let i = 0; i < MAX_DDG_RESULTS / 20; i++) {
                 fetchPromises.push(fetchDuckDuckGoResults(query, i * 20).catch(e => { console.error(`DDG fetch failed (start=${i*20}):`, e.message); return []; }));
            }

             fetchPromises.push(fetchSearxResults(query, MAX_SEARX_PAGES).catch(e => { console.error(`Searx fetch failed (${MAX_SEARX_PAGES} pages):`, e.message); return []; }));


            const allFetchedResults = await Promise.all(fetchPromises);

            const resultsMap = new Map<string, SearchResult>();

             allFetchedResults.flat().forEach(item => {
                 if (item?.link && item.title && !resultsMap.has(item.link)) {
                     resultsMap.set(item.link, item);
                 }
             });

            fullCombinedList = Array.from(resultsMap.values());

            if (fullCombinedList.length > 0) {
                 Cache.set(FULL_LIST_CACHE_KEY, fullCombinedList);
                 console.log(`Cached full aggregated list (${fullCombinedList.length} items) for query "${query}"`);
            } else {
                 if (allFetchedResults.flat().length === 0) {
                     Cache.set(FULL_LIST_CACHE_KEY, []);
                      console.log(`No results fetched for full aggregated list for query "${query}". Caching empty.`);
                 } else {
                      console.log(`Partial results (${fullCombinedList.length} items) fetched for full aggregated list for query "${query}". Caching partial list.`);
                      Cache.set(FULL_LIST_CACHE_KEY, fullCombinedList);
                 }
            }


        } catch (error: any) {
            console.error('Error fetching or processing full aggregated list:', error.message);
            Cache.set(FULL_LIST_CACHE_KEY, []);
            fullCombinedList = [];
        }
    }

    let filteredAndSortedList = fullCombinedList
        .filter(result => {
            return !containsExcludedScripts(result.title) && !containsExcludedScripts(result.snippet);
        })
        .sort((a, b) => {
            const aIsTR = a.link.toLowerCase().endsWith('.tr');
            const bIsTR = b.link.toLowerCase().endsWith('.tr');

            if (aIsTR && !bIsTR) {
                return -1;
            } else if (!aIsTR && bIsTR) {
                return 1;
            }
            return 0;
        });

    const slicedResults = filteredAndSortedList.slice(start, start + 10);

    console.log(`Returning sliced results (start=${start}, count=${slicedResults.length}) from filtered/sorted list (${filteredAndSortedList.length} items)`);

    return slicedResults;
}


export function checkBangRedirects(query: string): string | null {
    const bangs: { [key: string]: string } = {
        '!g': 'https://www.google.com/search?q=',
        '!w': 'https://tr.wikipedia.org/wiki/Special:Search?search=',
        '!bing': 'https://www.bing.com/search?q=',
        '!ddg': 'https://duckduckgo.com/?q=',
        '!amazon': 'https://www.amazon.com.tr/s?k=',
        '!yt': 'https://www.youtube.com/results?search_query=',
        '!news': '/news?q='
    };
    const parts = query.split(' ');
    const bang = parts[0].toLowerCase();
    if (bangs[bang]) {
        const searchQuery = parts.slice(1).join(' ');
        if (bang === '!news') {
             return `${bangs[bang]}${encodeURIComponent(searchQuery)}`;
        }
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
                 const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress?.replace('::ffff:', '') || '8.8.8.8';
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
            searchSource: 'Synapic Search',
            errorMessage: undefined
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


            let mainFetchPromise: Promise<any>;

            switch (type) {
                case 'web':
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    searchSourceText = 'Web Sonuçları (Birleşik)';
                    break;
                 case 'image':
                     mainFetchPromise = fetchBingImages(query);
                     searchSourceText = 'Görsel Sonuçları (Bing)';
                     break;
                case 'wiki':
                    mainFetchPromise = Promise.resolve([]);
                    searchSourceText = 'Wikipedia Sonucu';
                    break;
                 case 'video':
                     mainFetchPromise = fetchYoutubeResults(query);
                     searchSourceText = 'Video Sonuçları (YouTube)';
                     break;
                 case 'news':
                     mainFetchPromise = fetchNewsResults(query);
                     searchSourceText = 'Haber Sonuçları (gnews.io)';
                     break;
                default:
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    renderData.type = 'web';
                    type = 'web';
                    searchSourceText = 'Web Sonuçları (Birleşik - Varsayılan)';
            }

            renderData.searchSource = searchSourceText;

             fetchPromises.push(mainFetchPromise.catch((e: Error) => {
                 console.error(`${type} fetch failed inline:`, e.message);
                 if (type === 'wiki') return null;
                 return [];
              }));


            const [wikiResult, mainResults] = await Promise.all(fetchPromises);

            renderData.wiki = wikiResult as WikiSummary | null;

            switch (type) {
                 case 'web':
                     renderData.results = mainResults as SearchResult[] || [];
                     renderData.images = [];
                     renderData.videos = [];
                     renderData.newsResults = [];
                     break;
                 case 'image':
                     renderData.images = mainResults as ImageResult[] || [];
                     renderData.results = [];
                     renderData.videos = [];
                     renderData.newsResults = [];
                     break;
                 case 'video':
                     renderData.videos = mainResults as VideoResult[] || [];
                     renderData.results = [];
                     renderData.images = [];
                     renderData.newsResults = [];
                     break;
                case 'wiki':
                     renderData.results = [];
                     renderData.images = [];
                     renderData.videos = [];
                     renderData.newsResults = [];
                     break;
                 case 'news':
                     renderData.newsResults = mainResults as SearchResult[] || [];
                     renderData.results = [];
                     renderData.images = [];
                     renderData.videos = [];
                     break;
                default:
                     renderData.results = mainResults as SearchResult[] || [];
                      renderData.images = [];
                      renderData.videos = [];
                      renderData.newsResults = [];
                     break;
             }


        } catch (error: any) {
            console.error("Error during search processing:", error.message);
            renderData.searchSource = `Sonuçlar alınırken hata oluştu`;
            renderData.errorMessage = error.message;
             renderData.results = [];
             renderData.images = [];
             renderData.videos = [];
             renderData.newsResults = [];
        } finally {
            renderData.elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            if (renderData.errorMessage === undefined) {
                renderData.errorMessage = undefined;
            }
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

            let mainFetchPromise: Promise<any>;

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
                    mainFetchPromise = fetchWikiSummary(query, 'tr');
                    searchSourceApi = 'Wikipedia (API)';
                    break;
                 case 'video':
                     mainFetchPromise = fetchYoutubeResults(query);
                     searchSourceApi = 'YouTube Videoları (API)';
                     break;
                 case 'news':
                     mainFetchPromise = fetchNewsResults(query);
                     searchSourceApi = 'Haberler (API - gnews.io)';
                     break;
                default:
                    mainFetchPromise = getAggregatedWebResults(query, start);
                    type = 'web';
                    searchSourceApi = 'Birleşik Web (API - Varsayılan)';
            }

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
                    break;
                 case 'news':
                    apiResponse.newsResults = mainResult as SearchResult[] || [];
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
     app.get('/news', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=news`);
    });
}
