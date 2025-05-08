import axios, { isAxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';

export interface WikipediaSummaryApiResponse {
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
    getStorage: function(): Map<string, CacheItem<any>> {
        return cacheStorage;
    }
};

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchWikiSummary(query: string, lang: string = 'tr'): Promise<WikiSummary | null> {
    const cacheKey = `wiki_summary_${lang}_${query}`;
    const cachedData = Cache.get<WikiSummary>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get<WikipediaSummaryApiResponse>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
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
        return null;
    } catch (error: any) {
        if (isAxiosError(error) && error.response?.status === 404) {
            console.log(`Wikipedia'da "${query}" için özet bulunamadı (${lang}).`);
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
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
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
        Cache.set(cacheKey, images);
        return images;
    } catch (error: any) {
        console.error('Bing Images getirme hatası:', error.message);
        return [];
    }
}

export async function fetchGoogleNewsResults(query: string, start: number = 0): Promise<NewsResult[]> {
    const cacheKey = `google_news_${start}_${query}`;
    const cachedData = Cache.get<NewsResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        // Removed hl=tr, gl=TR, ceid=TR:tr from the URL
        const url = `https://news.google.com/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const news: NewsResult[] = [];
        $('article').each((i, el) => {
            const element = $(el);
            const title = element.find('h3 > a').text().trim();
            let link = element.find('h3 > a').attr('href');
            const snippet = element.find('span[jsname]').text().trim();
            const source = element.find('div[data-n-tid] a').text().trim();
            const image = element.find('figure img').attr('src') || null;

            if (title && link) {
                if (link.startsWith('./')) {
                    link = `https://news.google.com${link.substring(1)}`;
                }
                news.push({
                    news: title,
                    link: link,
                    snippet: snippet || 'Özet bulunamadı.',
                    source: source || 'Bilinmeyen Kaynak',
                    image: image
                });
            }
        });
        Cache.set(cacheKey, news);
        return news;
    } catch (error: any) {
        console.error('Google News getirme hatası:', error.message);
        return [];
    }
}

export async function fetchYoutubeResults(query: string): Promise<VideoResult[]> {
    const cacheKey = `youtube_videos_${query}`;
    const cachedData = Cache.get<VideoResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        // The URL structure seems custom, keeping it as is.
        const url = `https://www.youtube.com/results?search_query=$$${encodeURIComponent(query)}`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
            timeout: 7000
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
                            let videoUrl = vr.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
                            if (videoUrl && !videoUrl.startsWith('http')) {
                                videoUrl = `https://www.youtube.com${videoUrl}`;
                            } else if (!videoUrl && vr.videoId) {
                                videoUrl = `https://www.youtube.com/watch?v=$$${vr.videoId}`;
                            }

                            videos.push({
                                title: vr.title?.runs?.[0]?.text || 'Başlık Yok',
                                url: videoUrl || `https://www.youtube.com/watch?v=$$${vr.videoId}`,
                                thumbnail: vr.thumbnail?.thumbnails?.[0]?.url || '',
                                source: vr.ownerText?.runs?.[0]?.text || 'YouTube'
                            });
                        }
                    }
                }
            } catch (e: any) {
                console.error("YouTube JSON verisi ayrıştırma hatası: ", e.message);
            }
        } else {
             console.warn("YouTube'dan ytInitialData çekilemedi. HTML yapısı değişmiş olabilir.");
        }
        Cache.set(cacheKey, videos);
        return videos;
    } catch (error: any) {
        console.error('YouTube getirme hatası:', error.message);
        return [];
    }
}

export function checkBangRedirects(query: string): string | null {
    const bangs: { [key: string]: string } = {
        '!g': 'https://www.google.com/search?q=',
        '!yt': 'https://www.youtube.com/results?search_query=',
        // Changed to en.wikipedia.org for neutrality
        '!w': 'https://en.wikipedia.org/wiki/Special:Search?search=',
        '!bing': 'https://www.bing.com/search?q=',
        '!ddg': 'https://duckduckgo.com/?q=',
        '!amazon': 'https://www.amazon.com.tr/s?k=', // Kept tr domain for Amazon as it's a specific regional site
    };
    const parts = query.split(' ');
    const bang = parts[0].toLowerCase();
    if (bangs[bang]) {
        const searchQuery = parts.slice(1).join(' ');
        return `${bangs[bang]}${encodeURIComponent(searchQuery)}`;
    }
    return null;
}

export async function fetchGoogleResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `google_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
        // Removed hl=tr and gl=tr from the URL
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results: SearchResult[] = [];
        $('div.g').each((_, element) => {
            const linkElement = $(element).find('a[jsname][href]');
            let resultUrl = linkElement.attr('href');
            const title = $(element).find('h3').text()?.trim() || '';
            const snippetElement = $(element).find('div[data-sncf="1"]');
            const snippet = snippetElement.text()?.trim() || '';
            const displayUrl = $(element).find('cite').first().text()?.trim() || '';
            if (resultUrl && title && !resultUrl.startsWith('/search') && !resultUrl.startsWith('#')) {
                if (resultUrl.startsWith('/url?q=')) {
                    try {
                        const parsedUrlParams = new URLSearchParams(resultUrl.split('?')[1]);
                        resultUrl = parsedUrlParams.get('q') || resultUrl;
                    } catch (e: any) {
                        console.error("Google yönlendirme URL'si ayrıştırılamadı:", e.message);
                    }
                }
                try {
                    const parsedResultUrl = new URL(resultUrl);
                    results.push({
                        title, link: resultUrl, snippet,
                        displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                        source: 'Google'
                    });
                } catch (e: any) {
                    console.error("Google için sonuç URL'si ayrıştırılamadı:", e.message, resultUrl);
                }
            }
        });
        Cache.set(cacheKey, results);
        return results;
    } catch (error: any) {
        console.error('Google getirme hatası:', error.message);
        return [];
    }
}

export async function fetchBingResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const first = start + 1;
    const cacheKey = `bing_web_${first}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
        // Removed setlang=tr and cc=tr from the URL
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results: SearchResult[] = [];
        $('li.b_algo').each((_, element) => {
            const titleNode = $(element).find('h2 a');
            const title = titleNode.text().trim() || '';
            const resultUrl = titleNode.attr('href') || '';
            const snippetNode = $(element).find('.b_caption p');
            const snippet = snippetNode.text().trim() || '';
            const displayUrl = $(element).find('cite').text().trim() || '';
            if (title && resultUrl) {
                try {
                    const parsedResultUrl = new URL(resultUrl);
                    results.push({
                        title, link: resultUrl, snippet,
                        displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                        source: 'Bing'
                    });
                } catch (e: any) {
                    console.error("Bing için sonuç URL'si ayrıştırılamadı:", e.message, resultUrl);
                }
            }
        });
        Cache.set(cacheKey, results);
        return results;
    } catch (error: any) {
        console.error('Bing getirme hatası:', error.message);
        return [];
    }
}

export async function fetchDuckDuckGoResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `duckduckgo_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
        // Removed kl=tr-tr from the URL
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${start}&kp=-2`;
        const { data } = await axios.get<string>(url, {
            headers: {
                'User-Agent': USER_AGENT, /* Removed Accept-Language */
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }, timeout: 10000
        });
        const $ = cheerio.load(data);
        const results: SearchResult[] = [];
        $('div.result').each((_, element) => {
            const titleElement = $(element).find('a.result__a');
            const title = titleElement.text().trim() || '';
            let resultUrl = titleElement.attr('href') || '';
            const snippet = $(element).find('div.result__snippet').text().trim() || '';
            const displayUrl = $(element).find('a.result__url').text().trim() || '';
            if (title && resultUrl) {
                if (resultUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
                    try {
                        const params = new URLSearchParams(resultUrl.split('?')[1]);
                        resultUrl = decodeURIComponent(params.get('uddg') || '');
                    } catch (e: any) {
                        console.error("DuckDuckGo yönlendirme URL'si ayrıştırılamadı:", e.message, resultUrl);
                        return;
                    }
                }
                if (!resultUrl.startsWith('http://') && !resultUrl.startsWith('https://')) {
                    resultUrl = `https://${resultUrl}`;
                }
                try {
                    const parsedResultUrl = new URL(resultUrl);
                    results.push({
                        title, link: resultUrl, snippet,
                        displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                        source: 'DuckDuckGo'
                    });
                } catch (e: any) {
                console.error("DuckDuckGo için sonuç URL'si ayrıştırılamadı:", e.message, resultUrl);
                }
            }
        });
        Cache.set(cacheKey, results);
        return results;
    } catch (error: any) {
        console.error('DuckDuckGo getirme hatası:', error.message);
        return [];
    }
}

export async function fetchYandexResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `yandex_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
        // Removed lr=113 and lang=tr from the URL
        const url = `https://yandex.com.tr/search/?text=${encodeURIComponent(query)}&p=${Math.floor(start / 10)}`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results: SearchResult[] = [];
        $('li.serp-item').each((_, element) => {
            const titleElement = $(element).find('h2 a');
            const title = titleElement.text().trim() || '';
            const resultUrl = titleElement.attr('href') || '';
            const snippet = $(element).find('div.organic__content-wrapper').text().trim() || '';
            const displayUrl = $(element).find('div.path a').text().trim() || '';
            if (title && resultUrl) {
                try {
                    const parsedResultUrl = new URL(resultUrl);
                    results.push({
                        title, link: resultUrl, snippet,
                        displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                        source: 'Yandex'
                    });
                } catch (e: any) {
                    console.error("Yandex için sonuç URL'si ayrıştırılamadı:", e.message, resultUrl);
                }
            }
        });
        Cache.set(cacheKey, results);
        return results;
    } catch (error: any) {
        console.error('Yandex getirme hatası:', error.message);
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
                    'User-Agent': USER_AGENT, /* Removed Accept-Language */
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive',
                    'Referer': 'https://www.ecosia.org/', 'Upgrade-Insecure-Requests': '1'
                }, timeout: 12000
            });
            const $ = cheerio.load(data);
            const results: SearchResult[] = [];
            $('div.result').each((_, element) => {
                const titleElement = $(element).find('a.result-title');
                const title = titleElement.text().trim() || '';
                const resultUrl = titleElement.attr('href') || '';
                const snippet = $(element).find('p.result-snippet').text().trim() || '';
                const displayUrl = $(element).find('span.result-url').text().trim() || '';
                if (title && resultUrl) {
                    try {
                        const parsedResultUrl = new URL(resultUrl);
                        results.push({
                            title, link: resultUrl, snippet,
                            displayUrl: displayUrl || parsedResultUrl.hostname.replace(/^www\./, ''),
                            source: 'Ecosia'
                        });
                    } catch (e: any) {
                        console.error("Ecosia için sonuç URL'si ayrıştırılamadı:", e.message, resultUrl);
                    }
                }
            });
            Cache.set(cacheKey, results);
            return results;
        } catch (error: any) {
            console.error(`Ecosia getirme hatası (deneme ${attempt + 1}/${maxRetries + 1}):`, error.message);
            if (isAxiosError(error) && error.response?.status === 403 && attempt < maxRetries) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }
            Cache.set(cacheKey, []);
            return [];
        }
    }
    Cache.set(cacheKey, []);
    return [];
}

export async function fetchTwitterResults(query: string): Promise<SearchResult[]> {
    const cacheKey = `twitter_web_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;
    try {
        // Removed lang=tr from the URL
        const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT /* Removed Accept-Language */ },
            timeout: 7000
        });
        const $ = cheerio.load(data);
        const results: SearchResult[] = [];
        $('article[data-testid="tweet"]').each((_, element) => {
            const tweetTextElement = $(element).find('div[data-testid="tweetText"]');
            const snippet = tweetTextElement.text().trim() || '';
            let link = '';
            const timeElement = $(element).find('time').closest('a');
            if (timeElement.length) {
                const href = timeElement.attr('href');
                if (href) {
                    link = `https://x.com${href}`;
                }
            }
            const title = snippet.length > 50 ? `${snippet.substring(0, 47)}...` : snippet;
            const userHandleElement = $(element).find('div[data-testid="User-Name"] a[href*="/"] span').filter((i, el) => $(el).text().startsWith('@'));
            const displayUrl = userHandleElement.first().text().trim() || 'X Kullanıcısı';
            if (snippet && link) {
                results.push({
                    title, link, snippet, displayUrl, source: 'X'
                });
            }
        });
        Cache.set(cacheKey, results);
        return results;
    } catch (error: any) {
        console.error('Twitter/X getirme hatası:', error.message);
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
        [googleResults, bingResults, duckDuckGoResults, yandexResults, ecosiaResults, twitterResults].forEach(resultSet => {
            resultSet.forEach(item => {
                if (!resultsMap.has(item.link)) {
                    resultsMap.set(item.link, item);
                }
            });
        });
        const combined = Array.from(resultsMap.values());
        Cache.set(cacheKey, combined);
        return combined;
    } catch (error: any) {
        console.error('Birleştirilmiş arama hatası:', error.message);
        return [];
    }
}
