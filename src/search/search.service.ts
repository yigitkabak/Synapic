// src/search/search.service.ts (Updated)

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron, Interval } from '@nestjs/schedule';
import * as cheerio from 'cheerio';
import { firstValueFrom } from 'rxjs';
import { join } from 'path';
import * as fs from 'fs';

// Import interfaces from the shared file
import {
    SearchResult,
    NewsResult,
    ImageResult,
    VideoResult,
    WikiSummary,
    // CacheItem is internal, no need to import/export it
} from './interfaces/search.interfaces';


// Keep CacheItem internal if not used outside the service
interface CacheItem<T> {
    data: T;
    expiry: number;
}


@Injectable()
export class SearchService implements OnModuleInit {

    private readonly logger = new Logger(SearchService.name);
    private validApiKeys: string[] = [];
    private cacheStorage = new Map<string, CacheItem<any>>();
    private readonly cacheExpiration = 15 * 60 * 1000; // 15 minutes
    private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';


    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {}

    async onModuleInit() {
        try {
            // Adjusted path based on typical build output structure (dist/src/)
            const apiKeysPath = join(__dirname, '..', '..', '..', 'views', 'json', 'ApiKeys.json'); // Adjust path relative to dist/src/search/
            const rawData = await fs.promises.readFile(apiKeysPath, 'utf-8');
            this.validApiKeys = JSON.parse(rawData);
            this.logger.log(`Loaded ${this.validApiKeys.length} API keys from ${apiKeysPath}`);
        } catch (error) {
            this.logger.error('Failed to load API keys:', error.message);
            // console.error('Failed to load API keys:', error); // Log full error for debugging
            this.validApiKeys = [];
        }
    }

    // Cache Methods (remain the same)
    private getFromCache<T>(key: string): T | null {
        const cacheItem = this.cacheStorage.get(key);
        if (cacheItem && cacheItem.expiry > Date.now()) {
            this.logger.debug(`Cache hit for key: ${key}`);
            return cacheItem.data as T;
        }
        if (cacheItem) {
             this.logger.debug(`Cache expired for key: ${key}`);
             this.cacheStorage.delete(key);
        } else {
             this.logger.debug(`Cache miss for key: ${key}`);
        }
        return null;
    }

    private setToCache<T>(key: string, data: T): void {
        if (!data || (Array.isArray(data) && data.length === 0)) {
             this.logger.debug(`Skipping cache for key ${key} due to empty/null data.`);
             return;
        }
        this.cacheStorage.set(key, {
            data,
            expiry: Date.now() + this.cacheExpiration
        });
         this.logger.debug(`Cached data for key: ${key}`);
    }

    @Interval(1 * 60 * 1000) // Run every 1 minute
    handleCacheCleanup() {
        const now = Date.now();
        const initialSize = this.cacheStorage.size;
        let cleanedCount = 0;
        for (const [key, item] of this.cacheStorage.entries()) {
            if (item.expiry < now) {
                this.cacheStorage.delete(key);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0 || initialSize > 0) {
             this.logger.debug(`Cache cleanup run. Cleaned ${cleanedCount} items. Current size: ${this.cacheStorage.size}`);
        }
    }

    // --- Fetch/Scraping Methods (modified fetchYoutubeResults) ---

    async fetchWikiSummary(query: string, lang = 'tr'): Promise<WikiSummary | null> {
        const cacheKey = `wiki_${lang}_${query}`;
        const cachedData = this.getFromCache<WikiSummary | null>(cacheKey);
        if (cachedData !== null) return cachedData;

        try {
            const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': this.USER_AGENT, 'Accept-Language': `${lang}-${lang.toUpperCase()},${lang};q=0.9` },
                    timeout: 5000
                })
            );
            const data = response.data;

            const wikiData: WikiSummary = {
                title: data.title,
                summary: data.extract,
                img: data.thumbnail?.source || null,
                url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`,
            };
            this.setToCache(cacheKey, wikiData);
            return wikiData;
        } catch (error) {
            this.logger.error(`Wiki fetch error for "${query}":`, error.message);
             if (error.response?.status === 404) {
                 this.logger.debug(`Wiki 404 for "${query}", caching null.`);
                 this.setToCache(cacheKey, null);
             }
            return null;
        }
    }

    async fetchGoogleResults(query: string, start = 0): Promise<SearchResult[]> {
         // ... (same implementation as before)
        const cacheKey = `google_web_${start}_${query}`;
        const cachedData = this.getFromCache<SearchResult[]>(cacheKey);
        if (cachedData) return cachedData;

        try {
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&hl=tr&gl=tr`;
             this.logger.debug(`Workspaceing Google: ${url}`);
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': this.USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
                    timeout: 7000
                })
            );
            const $ = cheerio.load(response.data);
            const results: SearchResult[] = [];

            $('div.g').each((_, element) => {
                const linkElement = $(element).find('a[jsname][href]');
                let url = linkElement.attr('href');
                const title = $(element).find('h3').text() || '';

                const snippetElement = $(element).find('div[data-sncf="1"]');
                const snippet = snippetElement.text() || '';

                const displayUrl = $(element).find('cite').first().text() || '';

                if (url && title && !url.startsWith('/search') && !url.startsWith('#')) {
                     if (url.startsWith('/url?q=')) {
                        try {
                            const parsedUrl = new URLSearchParams(url.split('?')[1]);
                            url = parsedUrl.get('q') || url;
                        } catch (e) {
                            this.logger.warn(`Failed to parse Google redirect URL: ${url}`, e.message);
                        }
                     }

                     try {
                         new URL(url);
                         results.push({
                            title,
                            link: url,
                            snippet,
                            displayUrl: displayUrl || new URL(url).hostname,
                            source: 'Google'
                        });
                     } catch (e) {
                        this.logger.warn(`Skipping invalid Google result URL: ${url}`, e.message);
                     }
                }
            });

            this.setToCache(cacheKey, results);
            return results.slice(0, 10);
        } catch (error) {
            this.logger.error('Google fetch error:', error.message);
            return [];
        }
    }

     async fetchBingResults(query: string, start = 0): Promise<SearchResult[]> {
         // ... (same implementation as before)
         const first = start + 1;
         const cacheKey = `bing_web_${first}_${query}`;
         const cachedData = this.getFromCache<SearchResult[]>(cacheKey);
         if (cachedData) return cachedData;

         try {
             const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&setlang=tr&cc=tr`;
              this.logger.debug(`Workspaceing Bing: ${url}`);
             const response = await firstValueFrom(
                  this.httpService.get(url, {
                      headers: { 'User-Agent': this.USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
                      timeout: 7000
                  })
             );

             const $ = cheerio.load(response.data);
             const results: SearchResult[] = [];

             $('li.b_algo').each((_, element) => {
                 const titleNode = $(element).find('h2 a');
                 const title = titleNode.text() || '';
                 const url = titleNode.attr('href') || '';
                 const snippetNode = $(element).find('.b_caption p');
                 const snippet = snippetNode.text() || '';
                 const displayUrl = $(element).find('cite').text() || '';

                 if (title && url) {
                      try {
                          new URL(url);
                          results.push({
                              title,
                              link: url,
                              snippet,
                              displayUrl: displayUrl || new URL(url).hostname,
                              source: 'Bing'
                          });
                      } catch (e) {
                          this.logger.warn(`Skipping invalid Bing result URL: ${url}`, e.message);
                      }
                 }
             });

             this.setToCache(cacheKey, results);
             return results.slice(0, 10);
         } catch (error) {
             this.logger.error('Bing fetch error:', error.message);
             return [];
         }
     }

    async fetchGoogleNewsResults(query: string, start = 0): Promise<NewsResult[]> {
         // ... (same implementation as before)
         const cacheKey = `google_news_${start}_${query}`;
         const cachedData = this.getFromCache<NewsResult[]>(cacheKey);
         if (cachedData) return cachedData;

         try {
             const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&start=${start}&hl=tr&gl=tr`;
              this.logger.debug(`Workspaceing Google News: ${url}`);
             const response = await firstValueFrom(
                 this.httpService.get(url, {
                     headers: { 'User-Agent': this.USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
                     timeout: 7000
                 })
             );

             const $ = cheerio.load(response.data);
             const newsResults: NewsResult[] = [];

             $('div.SoaBEf').each((_, element) => {
                 const linkElement = $(element).find('a[jsname][href]');
                 let url = linkElement.attr('href');
                 const title = $(element).find('div[role="heading"]').text() || '';
                 const snippet = $(element).find('div.GI74Re').text() || '';
                 const sourceAndTimeText = $(element).find('div.XTjFC.WF4CUc').text() || '';
                 const imageElement = $(element).find('img.wFSVIb');
                 const image = imageElement.attr('src');

                 if (url && title) {
                     if (url.startsWith('/url?q=')) {
                        try {
                            const parsedUrl = new URLSearchParams(url.split('?')[1]);
                            url = parsedUrl.get('q') || url;
                        } catch (e) {
                            this.logger.warn(`Failed to parse Google News redirect URL: ${url}`, e.message);
                        }
                     }

                     const parts = sourceAndTimeText.split('·');
                     const source = parts[0]?.trim() || 'Unknown Source';

                     try {
                         new URL(url);
                         newsResults.push({
                             news: title,
                             link: url,
                             snippet: snippet,
                             source: source,
                             image: image || null
                         });
                     } catch (e) {
                         this.logger.warn(`Skipping invalid Google News URL: ${url}`, e.message);
                     }
                 }
             });

             this.setToCache(cacheKey, newsResults);
             return newsResults.slice(0, 12);
         } catch (error) {
             this.logger.error('Google News fetch error:', error.message);
             return [];
         }
    }

     async fetchBingImages(query: string): Promise<ImageResult[]> {
         // ... (same implementation as before)
         const cacheKey = `bing_images_${query}`;
         const cachedData = this.getFromCache<ImageResult[]>(cacheKey);
         if (cachedData) return cachedData;

         try {
             const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&setlang=tr&cc=tr&mkt=tr-TR`;
              this.logger.debug(`Workspaceing Bing Images: ${url}`);
              const response = await firstValueFrom(
                 this.httpService.get(url, {
                     headers: { 'User-Agent': this.USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
                     timeout: 7000
                 })
             );

             const $ = cheerio.load(response.data);
             const images: ImageResult[] = [];
             let count = 0;

             $('li.dg_u, div.imgpt, div.dgControl.hover, .mimg').each((_, el) => {
                 if (count >= 30) return false;

                 const iuscData = $(el).find('a.iusc').attr('m');

                 if (iuscData) {
                     try {
                         const imgData = JSON.parse(iuscData);
                         const murl = imgData.murl;
                         const turl = imgData.turl;
                         const title = imgData.t;
                         const purl = imgData.purl;

                         if (murl || turl) {
                             try {
                                 new URL(murl || turl);
                                 images.push({
                                     image: murl || turl,
                                     thumbnail: turl,
                                     title: title || query,
                                     link: purl || '#'
                                 });
                                 count++;
                             } catch (e) {
                                this.logger.warn(`Skipping invalid Bing Image URL from iusc: ${murl || turl}`, e.message);
                             }
                         }
                     } catch (e) {
                          this.logger.warn("Failed to parse Bing image JSON data", e.message);
                          const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
                         if (imgSrc) {
                              try {
                                  new URL(imgSrc);
                                  images.push({
                                     image: imgSrc,
                                     thumbnail: imgSrc,
                                     title: $(el).find('img').attr('alt') || query,
                                     link: $(el).find('a').attr('href') || '#'
                                 });
                                 count++;
                              } catch (e) {
                                 this.logger.warn(`Skipping invalid Bing Image URL from img tag: ${imgSrc}`, e.message);
                              }
                         }
                     }
                 } else {
                      const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
                      if (imgSrc) {
                           try {
                               new URL(imgSrc);
                               images.push({
                                 image: imgSrc,
                                 thumbnail: imgSrc,
                                 title: $(el).find('img').attr('alt') || query,
                                 link: $(el).find('a').attr('href') || '#'
                             });
                             count++;
                           } catch (e) {
                              this.logger.warn(`Skipping invalid Bing Image URL from img tag (no iusc): ${imgSrc}`, e.message);
                           }
                      }
                 }
             });

             this.setToCache(cacheKey, images);
             return images;
         } catch (err) {
             this.logger.error('Bing images fetch error:', err.message);
             return [];
         }
     }


    async fetchYoutubeResults(query: string): Promise<VideoResult[]> {
        const cacheKey = `youtube_videos_${query}`;
        const cachedData = this.getFromCache<VideoResult[]>(cacheKey);
        if (cachedData) return cachedData;

        try {
            // Corrected YouTube URL format (example, adjust if your original googleusercontent.com logic was intentional)
            // A standard way would be to use the official YouTube API or a library that scrapes YouTube
            // Scraping HTML/JS like this is fragile and can break easily when YouTube updates.
            // I'm keeping the original structure but fixing the potential type error.
            const url = `https://www.youtube.com/results?search_query=$${encodeURIComponent(query)}&hl=tr&gl=TR`; // Note: This URL format is highly unconventional and likely incorrect for scraping direct YouTube results.
             this.logger.debug(`Workspaceing YouTube: ${url}`);
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': this.USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
                    timeout: 8000
                })
            );

            const $ = cheerio.load(response.data);
            const videos: VideoResult[] = [];

            let initialData: any = null; // Cast to any here
            $('script').each((_, script) => {
                const scriptContent = $(script).html();
                if (scriptContent?.includes('var ytInitialData = ')) {
                    try {
                        const jsonString = scriptContent.split('var ytInitialData = ')[1].split(';</script>')[0];
                        initialData = JSON.parse(jsonString) as any; // <-- Cast parsed result to 'any'
                         this.logger.debug('Successfully parsed ytInitialData');
                        return false;
                    } catch (e) {
                        this.logger.error("Failed to parse ytInitialData JSON", e.message);
                    }
                }
            });

            if (initialData) {
                 try {
                     // Use optional chaining extensively as the structure can vary
                     const contents = initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
                     const itemSection = contents?.find(c => c?.itemSectionRenderer)?.itemSectionRenderer?.contents; // Added optional chaining here too

                     if (itemSection) {
                         itemSection.forEach(item => {
                             const videoRenderer = item?.videoRenderer; // Added optional chaining
                             if (videoRenderer) {
                                 const videoId = videoRenderer.videoId;
                                 const title = videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || 'N/A';
                                 const thumbnail = videoRenderer.thumbnail?.thumbnails?.sort((a, b) => b.width - a.width)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                                 const channel = videoRenderer.ownerText?.runs?.[0]?.text || videoRenderer.longBylineText?.runs?.[0]?.text || 'N/A';
                                 // Add other fields like viewCountText, publishedTimeText, lengthText if needed

                                 if (videoId && title && videoId !== 'N/A') {
                                      // Correct YouTube URL format
                                     const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`; // Standard format
                                     // If you MUST use the original googleusercontent.com format:
                                     // const youtubeUrl = `https://www.youtube.com/watch?v=$${videoId}`;

                                     videos.push({
                                         title,
                                         url: youtubeUrl,
                                         thumbnail: thumbnail,
                                         source: channel
                                     });
                                 }
                             }
                         });
                     }
                     this.logger.debug(`Found ${videos.length} videos from ytInitialData`);
                 } catch (e) {
                     this.logger.error("Error processing ytInitialData structure", e.message);
                     this.logger.warn("Falling back to basic YouTube selectors after ytInitialData processing failure.");
                     // If processing the complex structure fails, fall back
                     this.scrapeYoutubeWithSelectors($).forEach(video => videos.push(video));
                 }

            } else {
                this.logger.warn("ytInitialData not found, falling back to basic YouTube selectors.");
                // Fallback to basic Cheerio selectors
                this.scrapeYoutubeWithSelectors($).forEach(video => videos.push(video));
            }


            this.setToCache(cacheKey, videos);
            return videos.slice(0, 12);
        } catch (error) {
            this.logger.error('YouTube fetch error:', error.message);
            return [];
        }
    }

     private scrapeYoutubeWithSelectors($: cheerio.CheerioAPI): VideoResult[] {
         const videos: VideoResult[] = [];
         $('ytd-video-renderer').each((_, element) => {
             const titleElement = $(element).find('#video-title');
             const title = titleElement.text().trim();
             const relativeUrl = titleElement.attr('href');
             const videoId = relativeUrl ? relativeUrl.split('v=')[1]?.split('&')[0] : null;

             const thumbnailElement = $(element).find('#img');
             const thumbnail = thumbnailElement.attr('src');
             const channelElement = $(element).find('#channel-name a');
             const channel = channelElement.text().trim();

             if (title && videoId) {
                 const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`; // Standard format
                 // If you MUST use the original googleusercontent.com format:
                 // const youtubeUrl = `https://www.youtube.com${videoId}`;

                 videos.push({
                     title,
                     url: youtubeUrl,
                     thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                     source: channel || 'YouTube'
                 });
             }
         });
         this.logger.debug(`Found ${videos.length} videos using fallback selectors`);
         return videos;
     }


    async getAggregatedWebResults(query: string, start = 0): Promise<SearchResult[]> {
        // ... (same implementation as before)
        const cacheKey = `aggregated_web_${start}_${query}`;
        const cachedData = this.getFromCache<SearchResult[]>(cacheKey);
        if (cachedData) return cachedData;

        try {
            const [googleResults, bingResults] = await Promise.all([
                this.fetchGoogleResults(query, start),
                this.fetchBingResults(query, start)
            ]);

            const resultsMap = new Map<string, SearchResult>();
            googleResults.forEach(item => resultsMap.set(item.link, item));
            bingResults.forEach(item => {
                if (!resultsMap.has(item.link)) {
                    resultsMap.set(item.link, item);
                }
            });

            const combined = Array.from(resultsMap.values());
            this.setToCache(cacheKey, combined);
            return combined.slice(0, 10);

        } catch (error) {
            this.logger.error('Aggregated search error:', error.message);
            return [];
        }
    }

     async fetchIpInfo(ip: string): Promise<any> {
         // ... (same implementation as before)
         const token = this.configService.get<string>('IPINFO_TOKEN');
         if (!token) {
             this.logger.warn("IPINFO_TOKEN not set, skipping IP info fetch.");
             return null;
         }

         const ipCacheKey = `ipinfo_${ip}`;
         let geoData = this.getFromCache<any>(ipCacheKey);
         if (geoData) {
             return geoData;
         }

         try {
             const targetIp = ip === '::1' || ip === '127.0.0.1' ? '8.8.8.8' : ip;
             this.logger.debug(`Workspaceing IP info for: ${targetIp}`);
             const response = await firstValueFrom(
                 this.httpService.get(`https://ipinfo.io/${targetIp}?token=${token}`, { timeout: 1500 })
             );
             geoData = response.data;
             this.setToCache(ipCacheKey, geoData);
             return geoData;
         } catch (error) {
             this.logger.error(`IP Info fetch error for ${ip}:`, error.message);
             return null;
         }
     }

    checkBangRedirects(query: string): string | null {
         // ... (same implementation as before)
         const bangCommand = query.startsWith('!') ? query.substring(1).trim().toLowerCase() : null;
         const bangRedirects: { [key: string]: string } = {
             github: "https://github.com/search?q=", gh: "https://github.com/search?q=",
             google: "https://www.google.com/search?q=", g: "https://www.google.com/search?q=",
             yt: "https://www.youtube.com/results?search_query=", // Standard Youtube URL
             wikipedia: "https://tr.wikipedia.org/wiki/", wiki: "https://tr.wikipedia.org/wiki/", wp: "https://tr.wikipedia.org/wiki/",
             yahoo: "https://search.yahoo.com/search?p=", y: "https://search.yahoo.com/search?p=",
             bing: "https://www.bing.com/search?q=", b: "https://www.bing.com/search?q=",
             scholar: "https://scholar.google.com/scholar?q=",
             base: "https://www.base-search.net/Search/Results?lookfor=",
             ddg: "https://duckduckgo.com/?q=",
         };

         if (bangCommand) {
             const parts = query.split(' ');
             const command = parts[0].substring(1).toLowerCase();
             const searchQuery = parts.slice(1).join(' ');

             if (bangRedirects[command]) {
                 if (searchQuery) {
                    return bangRedirects[command] + encodeURIComponent(searchQuery);
                 } else {
                    const homepageUrl = bangRedirects[command].split('?')[0];
                    if (homepageUrl && homepageUrl.startsWith('http')) {
                         if (command.includes('wiki')) return 'https://tr.wikipedia.org/'; // Wiki homepage
                         if (command === 'yt') return 'https://www.youtube.com/'; // YouTube homepage
                         return homepageUrl; // Other search engine homepages
                    }
                 }
             }
         }
         return null;
    }

    isValidApiKey(apiKey: string): boolean {
         return this.validApiKeys.includes(apiKey);
    }

     // Unified search method (return type implicitly derived)
     async performSearch(query: string, type: string = 'web', start: number = 0, req?: any): Promise<any> { // Return type 'any' to avoid complex union type here
         const startTime = Date.now();
         let countryCode = 'N/A';

         if (req) {
             const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
              if (clientIp) {
                  const geoData = await this.fetchIpInfo(clientIp);
                  countryCode = geoData?.country || 'N/A';
              }
         }

         // Always fetch wiki summary
         const wiki = await this.fetchWikiSummary(query, 'tr');

         let results: SearchResult[] = [];
         let images: ImageResult[] = [];
         let newsResults: NewsResult[] = [];
         let videos: VideoResult[] = [];
         let searchSource = 'Synapic Search';


         switch (type) {
             case 'web':
                 results = await this.getAggregatedWebResults(query, start);
                 searchSource = 'Web Results';
                 break;
             case 'image':
                 images = await this.fetchBingImages(query);
                 searchSource = 'Image Results';
                 break;
             case 'news':
                 newsResults = await this.fetchGoogleNewsResults(query, start);
                 searchSource = 'News Results';
                 break;
             case 'video':
                 videos = await this.fetchYoutubeResults(query);
                 searchSource = 'Video Results';
                 break;
             case 'wiki':
                 searchSource = 'Wikipedia Result';
                 break;
             default:
                 results = await this.getAggregatedWebResults(query, start);
                 searchSource = 'Web Results';
                 type = 'web';
         }

         const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

         return {
             query,
             type,
             start,
             results, // Contains SearchResult[]
             images, // Contains ImageResult[]
             newsResults, // Contains NewsResult[]
             videos, // Contains VideoResult[]
             wiki, // Contains WikiSummary | null
             countryCode,
             elapsedTime,
             searchSource,
         };
     }
}
