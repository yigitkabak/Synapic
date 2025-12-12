import express, { Request, Response, NextFunction } from "express";
import { fetchBingImages, fetchNewsResults, fetchYoutubeResults, getAggregatedWebResults, fetchWikiSummary, WikiSummary, SearchResult, ImageResult, VideoResult } from "./src/search";
// keys.json dosyasını import ederken Node.js'te genellikle 'with { type: "json" }' ifadesi kullanılmaz.
import validApiKeys from "./src/json/keys.json";

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

const app = express();
const PORT = 3000;

app.use(express.json());

const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.query.apikey as string;
    // validApiKeys listesini kontrol et
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        res.status(403).json({ error: "Invalid or missing API key" });
        return;
    }
    next();
};

app.get("/api/search", checkApiKey, async (req: Request, res: Response) => {
    const query = (req.query.query as string || req.query.q as string)?.trim();
    let type = (req.query.type as string || "web").toLowerCase();
    const start = Math.max(0, parseInt((req.query.start as string) || "0"));
    const lang = ((req.query.lang as string) || "tr").toLowerCase();

    if (!query) {
        res.status(400).json({ error: "Search query missing!" });
        return;
    }

    try {
        let searchSourceApi: string = "API Results";

        // Wiki araması sadece 'wiki' tipinde yapılmıyorsa bile (diğer tipler için özet almak amacıyla)
        const wikiPromise = (type === 'wiki') ?
            fetchWikiSummary(query, lang)
            .catch((e: Error) => { return null; })
            : Promise.resolve(null);

        let mainFetchPromise: Promise<any>;

        switch (type) {
            case "web":
                mainFetchPromise = getAggregatedWebResults(query, start, lang);
                searchSourceApi = "Aggregated Web (API)";
                break;
            case "image":
                mainFetchPromise = fetchBingImages(query, lang);
                searchSourceApi = "Bing Images (API)";
                break;
            case "wiki":
                mainFetchPromise = fetchWikiSummary(query, lang);
                searchSourceApi = "Wikipedia (API)";
                break;
            case "video":
                mainFetchPromise = fetchYoutubeResults(query, lang);
                searchSourceApi = "YouTube Videos (API)";
                break;
            case "news":
                mainFetchPromise = fetchNewsResults(query, lang);
                searchSourceApi = "News (API - gnews.io)";
                break;
            default:
                mainFetchPromise = getAggregatedWebResults(query, start, lang);
                type = "web";
                searchSourceApi = "Aggregated Web (API - Default)";
        }

        const [wikiResultForOtherTypes, mainResult] = await Promise.all([
            wikiPromise,
            mainFetchPromise.catch((e: Error) => {
                return [];
            })
        ]);

        const apiResponse: ApiResponse = {
            query,
            type,
            searchSource: searchSourceApi,
            wiki: (type === "wiki" ? mainResult : wikiResultForOtherTypes) as WikiSummary | null,
        };

        switch (type) {
            case "web":
                apiResponse.results = mainResult as SearchResult[] || [];
                break;
            case "image":
                apiResponse.images = mainResult as ImageResult[] || [];
                break;
            case "video":
                apiResponse.videos = mainResult as VideoResult[] || [];
                break;
            case "wiki":
                break;
            case "news":
                apiResponse.newsResults = mainResult as SearchResult[] || [];
                break;
            default:
                apiResponse.results = mainResult as SearchResult[] || [];
                break;
        }

        res.json(apiResponse);
    } catch (error: any) {
        res.status(500).json({ error: "A server error occurred during search." });
    }
});

app.listen(PORT, () => {
    console.log(`API Server is running on http://localhost:${PORT}`);
});