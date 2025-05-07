import { Express, Request, Response, NextFunction } from 'express';
import axios from 'axios'; // Named import AxiosError kaldırıldı
import validApiKeys from '../views/json/ApiKeys.json';

import {
    fetchWikiSummary,
    fetchBingImages,
    fetchGoogleNewsResults,
    fetchYoutubeResults,
    getAggregatedWebResults,
    checkBangRedirects,
    Cache,
    WikiSummary, SearchResult, ImageResult, NewsResult, VideoResult, IPInfoData
} from './dataFetchers';

interface RenderData {
    query: string;
    type: string;
    start: number;
    results: SearchResult[];
    images: ImageResult[];
    newsResults: NewsResult[];
    videos: VideoResult[];
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
    newsResults?: NewsResult[];
    videos?: VideoResult[];
    error?: string;
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
        const type = (req.query.type as string || 'web').toLowerCase();
        const start = Math.max(0, parseInt(req.query.start as string) || 0);

        if (!query) {
            return res.redirect('/');
        }

        const bangRedirect = checkBangRedirects(query);
        if (bangRedirect) {
            return res.redirect(bangRedirect);
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
                 // axios.isAxiosError kontrolü burada da eklenebilir, ancak şimdilik genel hata mesajı yeterli.
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
            fetchPromises.push(fetchWikiSummary(query, 'tr')
                .catch((e: Error) => { console.error("Wiki fetch failed inline:", e.message); return null; }));

            let mainFetchPromise: Promise<any[]>;
            switch (type) {
                case 'web': mainFetchPromise = getAggregatedWebResults(query, start); renderData.searchSource = 'Web Results'; break;
                case 'image': mainFetchPromise = fetchBingImages(query); renderData.searchSource = 'Image Results'; break;
                case 'news': mainFetchPromise = fetchGoogleNewsResults(query, start); renderData.searchSource = 'News Results'; break;
                case 'wiki': mainFetchPromise = Promise.resolve([]); renderData.searchSource = 'Wikipedia Result'; break;
                case 'video': mainFetchPromise = fetchYoutubeResults(query); renderData.searchSource = 'Video Results'; break;
                default: mainFetchPromise = getAggregatedWebResults(query, start); renderData.type = 'web'; renderData.searchSource = 'Web Results (Fallback)';
            }
            fetchPromises.push(mainFetchPromise.catch((e: Error) => { console.error(`${type} fetch failed inline:`, e.message); return []; }));

            const [wikiResult, mainResults] = await Promise.all(fetchPromises);
            renderData.wiki = wikiResult as WikiSummary | null;

            switch (renderData.type) {
                case 'web': renderData.results = mainResults as SearchResult[] || []; break;
                case 'image': renderData.images = mainResults as ImageResult[] || []; break;
                case 'news': renderData.newsResults = mainResults as NewsResult[] || []; break;
                case 'video': renderData.videos = mainResults as VideoResult[] || []; break;
            }

        } catch (error: any) {
            console.error("Error during search processing:", error.message);
            renderData.searchSource = `Error retrieving results`;
        } finally {
            renderData.elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            res.render('results', renderData);
            return;
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
            let searchSource: string = '';
            const wikiPromise = fetchWikiSummary(query, 'tr');
            let mainFetchPromise: Promise<any[]>;

            switch (type) {
                case 'web': mainFetchPromise = getAggregatedWebResults(query, start); searchSource = 'Aggregated Web'; break;
                case 'image': mainFetchPromise = fetchBingImages(query); searchSource = 'Bing Images'; break;
                case 'news': mainFetchPromise = fetchGoogleNewsResults(query, start); searchSource = 'Google News'; break;
                case 'wiki': mainFetchPromise = Promise.resolve([]); searchSource = 'Wikipedia'; break;
                case 'video': mainFetchPromise = fetchYoutubeResults(query); searchSource = 'YouTube Videos'; break;
                default: mainFetchPromise = getAggregatedWebResults(query, start); searchSource = 'Aggregated Web (Fallback)'; type = 'web';
            }

            const [wiki, mainResults] = await Promise.all([
                 wikiPromise.catch((e: Error) => { console.error("API Wiki fetch failed:", e.message); return null; }),
                 mainFetchPromise.catch((e: Error) => { console.error(`API ${type} fetch failed:`, e.message); return []; })
            ]);

            const apiResponse: ApiResponse = {
                query, type, searchSource, wiki: wiki as WikiSummary | null,
            };

            switch (type) {
                case 'web': apiResponse.results = mainResults as SearchResult[]; break;
                case 'image': apiResponse.images = mainResults as ImageResult[]; break;
                case 'news': apiResponse.newsResults = mainResults as NewsResult[]; break;
                case 'video': apiResponse.videos = mainResults as VideoResult[]; break;
            }
            res.json(apiResponse);
            return;

         } catch (error: any) {
            console.error("API Search Error:", error.message);
            res.status(500).json({ error: "Arama sırasında bir sunucu hatası oluştu." });
            return;
         }
    });

    app.get('/', (req: Request, res: Response) => res.render('index'));
    app.get('/manifesto', (req: Request, res: Response) => res.render('manifesto'));
    app.get('/iletisim', (req: Request, res: Response) => res.render('iletisim', { messageSent: false }));

    app.get('/google', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=web`);
    });
    app.get('/bing', (req: Request, res: Response) => {
        const query = req.query.q as string || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=web`);
    });
}
