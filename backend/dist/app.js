"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const search_1 = require("./src/search");
// keys.json dosyasını import ederken Node.js'te genellikle 'with { type: "json" }' ifadesi kullanılmaz.
const keys_json_1 = __importDefault(require("./src/json/keys.json"));
const app = (0, express_1.default)();
const PORT = 3000;
app.use(express_1.default.json());
const checkApiKey = (req, res, next) => {
    const apiKey = req.query.apikey;
    // validApiKeys listesini kontrol et
    if (!apiKey || !keys_json_1.default.includes(apiKey)) {
        res.status(403).json({ error: "Invalid or missing API key" });
        return;
    }
    next();
};
app.get("/api/search", checkApiKey, async (req, res) => {
    const query = (req.query.query || req.query.q)?.trim();
    let type = (req.query.type || "web").toLowerCase();
    const start = Math.max(0, parseInt(req.query.start || "0"));
    const lang = (req.query.lang || "tr").toLowerCase();
    if (!query) {
        res.status(400).json({ error: "Search query missing!" });
        return;
    }
    try {
        let searchSourceApi = "API Results";
        // Wiki araması sadece 'wiki' tipinde yapılmıyorsa bile (diğer tipler için özet almak amacıyla)
        const wikiPromise = (type === 'wiki') ?
            (0, search_1.fetchWikiSummary)(query, lang)
                .catch((e) => { return null; })
            : Promise.resolve(null);
        let mainFetchPromise;
        switch (type) {
            case "web":
                mainFetchPromise = (0, search_1.getAggregatedWebResults)(query, start, lang);
                searchSourceApi = "Aggregated Web (API)";
                break;
            case "image":
                mainFetchPromise = (0, search_1.fetchBingImages)(query, lang);
                searchSourceApi = "Bing Images (API)";
                break;
            case "wiki":
                mainFetchPromise = (0, search_1.fetchWikiSummary)(query, lang);
                searchSourceApi = "Wikipedia (API)";
                break;
            case "video":
                mainFetchPromise = (0, search_1.fetchYoutubeResults)(query, lang);
                searchSourceApi = "YouTube Videos (API)";
                break;
            case "news":
                mainFetchPromise = (0, search_1.fetchNewsResults)(query, lang);
                searchSourceApi = "News (API - gnews.io)";
                break;
            default:
                mainFetchPromise = (0, search_1.getAggregatedWebResults)(query, start, lang);
                type = "web";
                searchSourceApi = "Aggregated Web (API - Default)";
        }
        const [wikiResultForOtherTypes, mainResult] = await Promise.all([
            wikiPromise,
            mainFetchPromise.catch((e) => {
                return [];
            })
        ]);
        const apiResponse = {
            query,
            type,
            searchSource: searchSourceApi,
            wiki: (type === "wiki" ? mainResult : wikiResultForOtherTypes),
        };
        switch (type) {
            case "web":
                apiResponse.results = mainResult || [];
                break;
            case "image":
                apiResponse.images = mainResult || [];
                break;
            case "video":
                apiResponse.videos = mainResult || [];
                break;
            case "wiki":
                break;
            case "news":
                apiResponse.newsResults = mainResult || [];
                break;
            default:
                apiResponse.results = mainResult || [];
                break;
        }
        res.json(apiResponse);
    }
    catch (error) {
        res.status(500).json({ error: "A server error occurred during search." });
    }
});
app.listen(PORT, () => {
    console.log(`API Server is running on http://localhost:${PORT}`);
});
