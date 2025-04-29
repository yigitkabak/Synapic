import axios from 'axios';
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
    getStorage: function() {
        return cacheStorage;
    }
};

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';


export async function fetchWikiSummary(query: string, lang: string = 'tr'): Promise<WikiSummary | null> {
    const cacheKey = `wiki_${lang}_${query}`;
    const cachedData = Cache.get<WikiSummary>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get<WikipediaSummaryApiResponse>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': `${lang}-${lang.toUpperCase()},${lang};q=0.9` },
            timeout: 5000
        });

        const wikiData: WikiSummary = {
            title: data.title,
            summary: data.extract,
            img: data.thumbnail?.source || null,
            url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        };
        Cache.set(cacheKey, wikiData);
        return wikiData;
    } catch (error: any) {
        if (error.response?.status === 404) {
            Cache.set(cacheKey, null);
        } else {
             console.error(`Wikipedia fetch error for "${query}":`, error.message);
        }
        return null;
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
                      results.push({
                         title,
                         link: url,
                         snippet,
                         displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                         source: 'Google'
                     });
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
                      results.push({
                         title,
                         link: url,
                         snippet,
                         displayUrl: displayUrl || parsedUrl.hostname.replace(/^www\./, ''),
                         source: 'Bing'
                     });
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


export async function fetchGoogleNewsResults(query: string, start: number = 0): Promise<NewsResult[]> {
    const cacheKey = `google_news_${start}_${query}`;
    const cachedData = Cache.get<NewsResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&start=${start}&hl=tr&gl=tr`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const newsResults: NewsResult[] = [];

        $('a[jsname][href]').closest('div.SoaBEf').each((_, element) => {
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
                       const parsedUrl = new URLSearchParams(url.split('?')[1]);
                       url = parsedUrl.get('q') || url;
                   } catch (e) {
                       console.error("Failed to parse Google News redirect URL:", (e as Error).message);
                    }
                }

                const source = sourceAndTime.split('·')[0]?.trim() || 'Unknown Source';

                newsResults.push({
                    news: title,
                    link: url || '#',
                    snippet: snippet,
                    source: source,
                    image: image || null
                });
            }
        });

        const slicedResults = newsResults.slice(0, 12);
        Cache.set(cacheKey, slicedResults);
        return slicedResults;
    } catch (error: any) {
        console.error('Google News fetch error:', error.message);
        return [];
    }
}


export async function fetchBingImages(query: string): Promise<ImageResult[]> {
    const cacheKey = `bing_images_${query}`;
    const cachedData = Cache.get<ImageResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&setlang=tr&cc=tr&mkt=tr-TR`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const images: ImageResult[] = [];
        let count = 0;

        $('li.dg_u, div.imgpt, div.dgControl.hover, .img_cont').each((_, el) => {
            if (count >= 30) return false;

            const jsonData = $(el).find('a.iusc').attr('m');
            if (jsonData) {
                try {
                    const imgData: any = JSON.parse(jsonData);
                    const murl = imgData.murl as string | undefined;
                    const turl = imgData.turl as string | undefined;
                    const title = imgData.t as string | undefined;

                    if (murl || turl) {
                        images.push({
                            image: murl || turl || '',
                            thumbnail: turl || murl || null,
                            title: title || query,
                            link: imgData.purl as string || '#'
                        });
                        count++;
                    }
                } catch (e) {
                    console.error("Failed to parse Bing image JSON data:", (e as Error).message);
                    const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
                    if (imgSrc) {
                         images.push({
                            image: imgSrc,
                            thumbnail: imgSrc,
                            title: $(el).find('img').attr('alt') || query,
                            link: $(el).find('a').attr('href') || '#'
                        });
                        count++;
                    }
                }
            } else {
                 const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
                 if (imgSrc) {
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

        Cache.set(cacheKey, images);
        return images;
    } catch (err: any) {
        console.error('Bing images fetch error:', err.message);
        return [];
    }
}


export async function fetchYoutubeResults(query: string): Promise<VideoResult[]> {
    const cacheKey = `youtube_videos_${query}`;
    const cachedData = Cache.get<VideoResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://m.youtube.com/results?search_query=$${encodeURIComponent(query)}&hl=tr`;
        const { data } = await axios.get<string>(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36', 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 8000
        });

        const $ = cheerio.load(data);
        const videos: VideoResult[] = [];

        let initialData: any = null;
        $('script').each((_, script) => {
            const scriptContent = $(script).html();
            if (scriptContent?.includes('var ytInitialData = ')) {
                try {
                    const jsonData = scriptContent.split('var ytInitialData = ')[1].split(';</script>')[0];
                    initialData = JSON.parse(jsonData);
                    return false;
                } catch (e) {
                    console.error("Failed to parse ytInitialData from m.youtube.com:", (e as Error).message);
                }
            }
        });

        if (initialData) {
            const contents = initialData?.contents?.sectionListRenderer?.contents;
            const itemSection = contents?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer?.contents;

            if (itemSection) {
                itemSection.forEach((item: any) => {
                    const videoRenderer = item.compactVideoRenderer || item.videoRenderer;
                    if (videoRenderer) {
                        const videoId = videoRenderer.videoId as string;
                        const title = videoRenderer.title?.runs?.[0]?.text as string || videoRenderer.title?.simpleText as string || 'N/A';

                        const thumbnail = videoRenderer.thumbnail?.thumbnails?.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0]?.url as string || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                        const channel = videoRenderer.longBylineText?.runs?.[0]?.text as string || videoRenderer.ownerText?.runs?.[0]?.text as string || 'N/A';

                        if (videoId && title) {
                            videos.push({
                                title,
                                url: `https://www.youtube.com/watch?v=$${videoId}`,
                                thumbnail: thumbnail,
                                source: channel
                            });
                        }
                    }
                });
            }
        } else {
             console.warn("Falling back to basic YouTube selectors for m.youtube.com.");
             $('ytm-compact-video-renderer').each((_, element) => {
                 const titleElement = $(element).find('.compact-media-item-headline');
                 const title = titleElement.text().trim();
                 const videoHref = $(element).attr('href');
                 const videoIdMatch = videoHref?.match(/\/watch\?v=([a-zA-Z0-9_-]+)/);
                 const videoId = videoIdMatch ? videoIdMatch[1] : null;
                 const url = videoId ? `https://www.youtube.com/watch?v=$${videoId}` : '';

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

        const slicedVideos = videos.slice(0, 12);
        Cache.set(cacheKey, slicedVideos);
        return slicedVideos;

    } catch (error: any) {
        console.error('YouTube fetch error:', error.message);
        return [];
    }
}


export async function getAggregatedWebResults(query: string, start: number = 0): Promise<SearchResult[]> {
    const cacheKey = `aggregated_web_${start}_${query}`;
    const cachedData = Cache.get<SearchResult[]>(cacheKey);
    if (cachedData) return cachedData;

    try {
        const [googleResults, bingResults] = await Promise.all([
            fetchGoogleResults(query, start),
            fetchBingResults(query, start)
        ]);

        const resultsMap = new Map<string, SearchResult>();

        googleResults.forEach(item => resultsMap.set(item.link, item));
        bingResults.forEach(item => {
            if (!resultsMap.has(item.link)) {
                resultsMap.set(item.link, item);
            }
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


export function checkBangRedirects(query: string): string | null {
     if (!query.startsWith('!')) return null;

     const parts = query.substring(1).split(' ');
     const command = parts[0].toLowerCase();
     const searchQuery = parts.slice(1).join(' ');

     const bangRedirects: { [key: string]: string } = {
         github: "https://github.com/search?q=", gh: "https://github.com/search?q=",
         google: "https://www.google.com/search?q=", g: "https://www.google.com/search?q=",
         yt: "https://www.youtube.com/results?search_query=",
         wikipedia: "https://tr.wikipedia.org/wiki/", wiki: "https://tr.wikipedia.org/wiki/", wp: "https://tr.wikipedia.org/wiki/",
         yahoo: "https://search.yahoo.com/search?p=", y: "https://search.yahoo.com/search?p=",
         bing: "https://www.bing.com/search?q=", b: "https://www.bing.com/search?q=",
         scholar: "https://scholar.google.com/scholar?q=",
         base: "https://www.base-search.net/Search/Results?lookfor=",
         ddg: "https://duckduckgo.com/?q=",
     };

     const redirectUrl = bangRedirects[command];

     if (redirectUrl) {
         if (searchQuery) {
             return redirectUrl + encodeURIComponent(searchQuery);
         } else {
              try {
                 const baseUrlWithoutParams = redirectUrl.split('?')[0];
                 return baseUrlWithoutParams;

              } catch (e) {
                  console.error("Failed to parse redirect URL for bang command:", (e as Error).message, redirectUrl);
                  return redirectUrl;
              }
         }
     }

     return null;
}
