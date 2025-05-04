"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkApiKey = checkApiKey;
exports.setupRoutes = setupRoutes;
const axios_1 = __importDefault(require("axios"));
const ApiKeys_json_1 = __importDefault(require("../views/json/ApiKeys.json"));
const dataFetchers_1 = require("./dataFetchers");
function checkApiKey(req, res, next) {
    const apiKey = req.query.apikey;
    if (!apiKey || !ApiKeys_json_1.default.includes(apiKey)) {
        res.status(403).json({ error: "Geçersiz veya eksik API anahtarı" });
        return;
    }
    next();
}
function setupRoutes(app, ipinfoToken) {
    app.get('/search', async (req, res) => {
        var _a;
        const startTime = Date.now();
        const query = (req.query.query || req.query.q || '').trim();
        const type = (req.query.type || 'web').toLowerCase();
        const start = Math.max(0, parseInt(req.query.start) || 0);
        if (!query) {
            return res.redirect('/');
        }
        const bangRedirect = (0, dataFetchers_1.checkBangRedirects)(query);
        if (bangRedirect) {
            return res.redirect(bangRedirect);
        }
        let countryCode = 'N/A';
        if (ipinfoToken) {
            try {
                const ip = ((_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.toString().split(',')[0]) || req.socket.remoteAddress || '8.8.8.8';
                const ipCacheKey = `ipinfo_${ip}`;
                let geoData = dataFetchers_1.Cache.get(ipCacheKey);
                if (!geoData) {
                    const response = await axios_1.default.get(`https://ipinfo.io/${ip}?token=${ipinfoToken}`, { timeout: 1500 });
                    geoData = response.data;
                    dataFetchers_1.Cache.set(ipCacheKey, geoData);
                }
                countryCode = (geoData === null || geoData === void 0 ? void 0 : geoData.country) || 'N/A';
            }
            catch (error) {
                console.error("IP Info fetch error:", error.message);
            }
        }
        const renderData = {
            query,
            type,
            start,
            results: [],
            images: [],
            newsResults: [],
            videos: [],
            wiki: null,
            countryCode,
            elapsedTime: '0.00',
            searchSource: 'Synapic Search'
        };
        try {
            const fetchPromises = [];
            fetchPromises.push((0, dataFetchers_1.fetchWikiSummary)(query, 'tr')
                .catch(e => { console.error("Wiki fetch failed inline:", e.message); return null; }));
            let mainFetchPromise;
            switch (type) {
                case 'web':
                    mainFetchPromise = (0, dataFetchers_1.getAggregatedWebResults)(query, start);
                    renderData.searchSource = 'Web Results';
                    break;
                case 'image':
                    mainFetchPromise = (0, dataFetchers_1.fetchBingImages)(query);
                    renderData.searchSource = 'Image Results';
                    break;
                case 'news':
                    mainFetchPromise = (0, dataFetchers_1.fetchGoogleNewsResults)(query, start);
                    renderData.searchSource = 'News Results';
                    break;
                case 'wiki':
                    mainFetchPromise = Promise.resolve([]);
                    renderData.searchSource = 'Wikipedia Result';
                    break;
                case 'video':
                    mainFetchPromise = (0, dataFetchers_1.fetchYoutubeResults)(query);
                    renderData.searchSource = 'Video Results';
                    break;
                default:
                    mainFetchPromise = (0, dataFetchers_1.getAggregatedWebResults)(query, start);
                    renderData.type = 'web';
                    renderData.searchSource = 'Web Results (Fallback)';
            }
            fetchPromises.push(mainFetchPromise.catch(e => { console.error(`${type} fetch failed inline:`, e.message); return []; }));
            const [wikiResult, mainResults] = await Promise.all(fetchPromises);
            renderData.wiki = wikiResult;
            switch (renderData.type) {
                case 'web':
                    renderData.results = mainResults || [];
                    break;
                case 'image':
                    renderData.images = mainResults || [];
                    break;
                case 'news':
                    renderData.newsResults = mainResults || [];
                    break;
                case 'video':
                    renderData.videos = mainResults || [];
                    break;
            }
        }
        catch (error) {
            console.error("Error during search processing:", error.message);
            renderData.searchSource = `Error retrieving results: ${error.message}`;
            renderData.results = [];
            renderData.images = [];
            renderData.newsResults = [];
            renderData.videos = [];
            renderData.wiki = null;
        }
        finally {
            renderData.elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            res.render('results', renderData);
            return;
        }
    });
    app.get('/api/search', checkApiKey, async (req, res) => {
        var _a;
        const query = (_a = (req.query.query || req.query.q)) === null || _a === void 0 ? void 0 : _a.trim();
        let type = (req.query.type || 'web').toLowerCase();
        const start = Math.max(0, parseInt(req.query.start) || 0);
        if (!query) {
            res.status(400).json({ error: "Arama sorgusu eksik!" });
            return;
        }
        try {
            let results;
            let images;
            let newsResults;
            let videos;
            let searchSource = '';
            const wikiPromise = (0, dataFetchers_1.fetchWikiSummary)(query, 'tr');
            let mainFetchPromise;
            switch (type) {
                case 'web':
                    mainFetchPromise = (0, dataFetchers_1.getAggregatedWebResults)(query, start);
                    searchSource = 'Aggregated Web';
                    break;
                case 'image':
                    mainFetchPromise = (0, dataFetchers_1.fetchBingImages)(query);
                    searchSource = 'Bing Images';
                    break;
                case 'news':
                    mainFetchPromise = (0, dataFetchers_1.fetchGoogleNewsResults)(query, start);
                    searchSource = 'Google News';
                    break;
                case 'wiki':
                    mainFetchPromise = Promise.resolve([]);
                    searchSource = 'Wikipedia';
                    break;
                case 'video':
                    mainFetchPromise = (0, dataFetchers_1.fetchYoutubeResults)(query);
                    searchSource = 'YouTube Videos';
                    break;
                default:
                    mainFetchPromise = (0, dataFetchers_1.getAggregatedWebResults)(query, start);
                    searchSource = 'Aggregated Web (Fallback)';
                    type = 'web';
            }
            const [wiki, mainResults] = await Promise.all([
                wikiPromise.catch(e => { console.error("API Wiki fetch failed:", e.message); return null; }),
                mainFetchPromise.catch(e => { console.error(`API ${type} fetch failed:`, e.message); return []; })
            ]);
            const apiResponse = {
                query,
                type,
                searchSource,
                wiki: wiki,
            };
            switch (type) {
                case 'web':
                    apiResponse.results = mainResults;
                    break;
                case 'image':
                    apiResponse.images = mainResults;
                    break;
                case 'news':
                    apiResponse.newsResults = mainResults;
                    break;
                case 'video':
                    apiResponse.videos = mainResults;
                    break;
            }
            res.json(apiResponse);
            return;
        }
        catch (error) {
            console.error("API Search Error:", error.message);
            res.status(500).json({ error: "Arama sırasında bir sunucu hatası oluştu." });
            return;
        }
    });
    app.get('/', (req, res) => res.render('index'));
    app.get('/manifesto', (req, res) => res.render('manifesto'));
    app.get('/iletisim', (req, res) => res.render('iletisim', { messageSent: false }));
    app.get('/google', (req, res) => {
        const query = req.query.q || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=web`);
    });
    app.get('/bing', (req, res) => {
        const query = req.query.q || '';
        res.redirect(`/search?query=${encodeURIComponent(query)}&type=web`);
    });
}
