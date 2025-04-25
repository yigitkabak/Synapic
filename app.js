require('dotenv').config(); // Load environment variables at the top
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 3000;
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
// Optional: Load Google API Key and CX from env if using the API function
// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// const GOOGLE_CX = process.env.GOOGLE_CX;

// Load valid API keys (keep as is or move to env/config)
const validApiKeys = require('./views/json/ApiKeys.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');
// Make sure 'public' directory exists for static files like CSS/JS if needed by the theme
app.use(express.static('public'));

// --- Caching Implementation ---
const cacheStorage = new Map();
const cacheExpiration = 15 * 60 * 1000; // 15 minutes cache

const Cache = {
    get: function(key) {
        const cacheItem = cacheStorage.get(key);
        if (cacheItem && cacheItem.expiry > Date.now()) {
            // console.log(`Cache HIT for ${key}`);
            return cacheItem.data;
        }
        // console.log(`Cache MISS for ${key}`);
        cacheStorage.delete(key); // Remove expired item
        return null;
    },
    set: function(key, data) {
        // console.log(`Cache SET for ${key}`);
        if (!data || (Array.isArray(data) && data.length === 0)) {
             // Avoid caching empty results to allow retries
             // console.log(`Skipping cache SET for empty data on key ${key}`);
             return;
        }
        cacheStorage.set(key, {
            data,
            expiry: Date.now() + cacheExpiration
        });
    }
};
// --- End Caching ---

// --- Helper: User Agent ---
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

// --- Fetching Functions ---

// Fetch Wikipedia Summary (Seems OK)
async function fetchWikiSummary(query, lang = 'tr') {
    const cacheKey = `wiki_${lang}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': `${lang}-${lang.toUpperCase()},${lang};q=0.9` },
            timeout: 5000 // Add timeout
        });

        const wikiData = {
            title: data.title,
            summary: data.extract,
            img: data.thumbnail?.source || null,
            url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`,
            // category: data.description || 'Vikipedi' // Category not used in new theme
        };
        Cache.set(cacheKey, wikiData);
        return wikiData;
    } catch (error) {
        // console.error("Wikipedia fetch error:", error.message);
        if (error.response?.status === 404) {
            Cache.set(cacheKey, null); // Cache not found results briefly
        }
        return null;
    }
}

// Fetch Google Web Results (Scraping)
async function fetchGoogleResults(query, start = 0) {
    const cacheKey = `google_web_${start}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&hl=tr&gl=tr`; // Added hl and gl for turkish results
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results = [];

        // Updated Selector - Google changes these often! This might need frequent adjustments.
        $('div.g').each((_, element) => {
            const linkElement = $(element).find('a[jsname][href]');
            let url = linkElement.attr('href');
            const title = $(element).find('h3').text() || '';
            // Try to find a more robust snippet selector
            const snippetElement = $(element).find('div[data-sncf="1"]');
            const snippet = snippetElement.text() || '';
            // Extract display URL/breadcrumbs if available
            const displayUrl = $(element).find('cite').first().text() || '';


            if (url && title && !url.startsWith('/search') && !url.startsWith('#')) { // Basic filtering
                 // Clean Google's tracking/redirect URLs if necessary (less common with direct .g selector)
                 if (url.startsWith('/url?q=')) {
                    try {
                        const parsedUrl = new URLSearchParams(url.split('?')[1]);
                        url = parsedUrl.get('q') || url;
                    } catch (e) { /* ignore parsing error */ }
                 }

                 results.push({
                    title,
                    link: url, // Use link instead of url to match EJS
                    snippet,
                    displayUrl: displayUrl || new URL(url).hostname, // Fallback hostname
                    source: 'Google'
                    // rating: Math.floor(Math.random() * 10) + 1 // Rating not used
                });
            }
        });

        Cache.set(cacheKey, results);
        return results.slice(0, 10); // Ensure max 10 results for pagination consistency
    } catch (error) {
        console.error('Google fetch error:', error.message);
        return [];
    }
}

// Fetch Bing Web Results (Scraping)
async function fetchBingResults(query, start = 0) {
    // Bing uses 'first' (1-based index), 'start' is 0-based index (0, 10, 20...)
    const first = start + 1;
    const cacheKey = `bing_web_${first}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&setlang=tr&cc=tr`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results = [];

        $('li.b_algo').each((_, element) => {
            const titleNode = $(element).find('h2 a');
            const title = titleNode.text() || '';
            const url = titleNode.attr('href') || '';
            const snippetNode = $(element).find('.b_caption p'); // Often holds the snippet
            const snippet = snippetNode.text() || '';
            const displayUrl = $(element).find('cite').text() || ''; // Display URL often in cite

            if (title && url) {
                results.push({
                    title,
                    link: url, // Use link
                    snippet,
                    displayUrl: displayUrl || new URL(url).hostname, // Fallback hostname
                    source: 'Bing'
                });
            }
        });

        Cache.set(cacheKey, results);
        return results.slice(0, 10); // Ensure max 10 results
    } catch (error) {
        console.error('Bing fetch error:', error.message);
        return [];
    }
}

// Fetch Google News Results (Scraping)
async function fetchGoogleNewsResults(query, start = 0) {
    const cacheKey = `google_news_${start}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        // Using tbm=nws for news tab
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&start=${start}&hl=tr&gl=tr`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const newsResults = [];

        // Selector for news results (may change!)
        $('a[jsname][href]').closest('div.SoaBEf').each((_, element) => {
            const linkElement = $(element).find('a[jsname][href]');
            let url = linkElement.attr('href');
            const title = $(element).find('div[role="heading"]').text() || '';
            const snippet = $(element).find('div.GI74Re').text() || ''; // News snippet selector
            const sourceAndTime = $(element).find('div.XTjFC.WF4CUc').text() || ''; // Source and time string
            const imageElement = $(element).find('img.wFSVIb');
            const image = imageElement.attr('src');

            if (url && title) {
                // Clean Google's tracking URLs if necessary
                if (url.startsWith('/url?q=')) {
                   try {
                       const parsedUrl = new URLSearchParams(url.split('?')[1]);
                       url = parsedUrl.get('q') || url;
                   } catch (e) { /* ignore parsing error */ }
                }

                // Basic parsing for source (might be brittle)
                const source = sourceAndTime.split('·')[0]?.trim() || 'Unknown Source';

                newsResults.push({
                    news: title, // Match EJS variable 'news' for title
                    link: url,
                    snippet: snippet, // Add snippet if needed by theme
                    source: source, // Add source if needed by theme
                    image: image || null // Pass image URL
                });
            }
        });

        Cache.set(cacheKey, newsResults);
        return newsResults.slice(0, 12); // News pages often show more, limit if needed
    } catch (error) {
        console.error('Google News fetch error:', error.message);
        return [];
    }
}


// Fetch Images from Bing (Seems OK, but selectors can change)
async function fetchBingImages(query) {
    const cacheKey = `bing_images_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&setlang=tr&cc=tr&mkt=tr-TR`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const images = [];
        let count = 0;

        // Common selector for image containers
        $('li.dg_u, div.imgpt, div.dgControl.hover').each((_, el) => {
            if (count >= 30) return false; // Limit results

            // Extract data often stored in JSON within 'm' attribute
            const jsonData = $(el).find('a.iusc').attr('m');
            if (jsonData) {
                try {
                    const imgData = JSON.parse(jsonData);
                    const murl = imgData.murl; // Media URL (often higher quality)
                    const turl = imgData.turl; // Thumbnail URL
                    const title = imgData.t; // Title

                    if (murl || turl) {
                        images.push({
                            image: murl || turl, // Prefer media URL
                            thumbnail: turl, // Store thumbnail separately if needed
                            title: title || query, // Use query as fallback title
                            link: imgData.purl || '#' // Page URL if available
                        });
                        count++;
                    }
                } catch (e) {
                    // Fallback to direct img src if JSON fails
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
                 // Fallback if 'm' attribute not found
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
    } catch (err) {
        console.error('Bing images fetch error:', err.message);
        return [];
    }
}

// Fetch Videos from YouTube (Scraping - Updated)
async function fetchYoutubeResults(query) {
    const cacheKey = `youtube_videos_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        // Scrape the actual YouTube results page
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=tr&gl=TR`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 8000
        });

        const $ = cheerio.load(data);
        const videos = [];

        // Try to extract data script (more robust than pure selectors usually)
        let initialData = null;
        $('script').each((_, script) => {
            const scriptContent = $(script).html();
            if (scriptContent?.includes('var ytInitialData = ')) {
                try {
                    const jsonData = scriptContent.split('var ytInitialData = ')[1].split(';</script>')[0];
                    initialData = JSON.parse(jsonData);
                    return false; // Stop searching scripts
                } catch (e) {
                    console.error("Failed to parse ytInitialData", e.message);
                }
            }
        });

        if (initialData) {
            // Navigate the complex JSON structure (this needs inspection of actual YouTube data)
            const contents = initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            const itemSection = contents?.find(c => c.itemSectionRenderer)?.itemSectionRenderer?.contents;

            if (itemSection) {
                itemSection.forEach(item => {
                    const videoRenderer = item.videoRenderer;
                    if (videoRenderer) {
                        const videoId = videoRenderer.videoId;
                        const title = videoRenderer.title?.runs?.[0]?.text || 'N/A';
                        // Find best thumbnail
                        const thumbnail = videoRenderer.thumbnail?.thumbnails?.sort((a, b) => b.width - a.width)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                        const channel = videoRenderer.ownerText?.runs?.[0]?.text || 'N/A';
                        // Add more details if needed (views, duration, etc.) - requires exploring the JSON further

                        if (videoId && title) {
                            videos.push({
                                title,
                                url: `https://www.youtube.com/watch?v=${videoId}`,
                                thumbnail: thumbnail,
                                source: channel // Use channel name as source
                            });
                        }
                    }
                });
            }
        } else {
            // Fallback to basic selectors if ytInitialData fails (less reliable)
             console.warn("Falling back to basic YouTube selectors.");
             $('ytd-video-renderer').each((_, element) => {
                 const titleElement = $(element).find('#video-title');
                 const title = titleElement.text().trim();
                 const url = 'https://www.youtube.com' + titleElement.attr('href');
                 const videoId = url.split('v=')[1]?.split('&')[0];
                 // Basic thumbnail extraction
                 const thumbnailElement = $(element).find('#img');
                 const thumbnail = thumbnailElement.attr('src');
                 const channelElement = $(element).find('#channel-name a');
                 const channel = channelElement.text().trim();

                 if (title && url && url.includes('/watch?v=')) {
                     videos.push({
                         title,
                         url,
                         thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, // Fallback thumbnail
                         source: channel || 'YouTube'
                     });
                 }
             });
        }


        Cache.set(cacheKey, videos);
        return videos.slice(0, 12); // Limit results
    } catch (error) {
        console.error('YouTube fetch error:', error.message);
        return [];
    }
}

// Combined Web Search (Google + Bing) - Simple aggregation
async function getAggregatedWebResults(query, start = 0) {
    const cacheKey = `aggregated_web_${start}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        // Fetch concurrently
        const [googleResults, bingResults] = await Promise.all([
            fetchGoogleResults(query, start),
            fetchBingResults(query, start)
        ]);

        // Simple interleaving / combining - prioritize Google, add unique Bing
        const resultsMap = new Map();
        googleResults.forEach(item => resultsMap.set(item.link, item)); // Use link as key
        bingResults.forEach(item => {
            if (!resultsMap.has(item.link)) {
                resultsMap.set(item.link, item);
            }
        });

        const combined = Array.from(resultsMap.values());
        Cache.set(cacheKey, combined);
        return combined.slice(0, 10); // Ensure max 10 results for pagination

    } catch (error) {
        console.error('Aggregated search error:', error.message);
        return [];
    }
}


// --- Bang Redirects --- (Seems OK)
function checkBangRedirects(query) {
     const bangCommand = query.startsWith('!') ? query.substring(1).trim().toLowerCase() : null;
     const bangRedirects = {
         github: "https://github.com/search?q=", gh: "https://github.com/search?q=",
         google: "https://www.google.com/search?q=", g: "https://www.google.com/search?q=",
         yt: "https://www.youtube.com/results?search_query=", // Corrected YouTube bang
         wikipedia: "https://tr.wikipedia.org/wiki/", wiki: "https://tr.wikipedia.org/wiki/", wp: "https://tr.wikipedia.org/wiki/",
         yahoo: "https://search.yahoo.com/search?p=", y: "https://search.yahoo.com/search?p=",
         bing: "https://www.bing.com/search?q=", b: "https://www.bing.com/search?q=",
         scholar: "https://scholar.google.com/scholar?q=",
         base: "https://www.base-search.net/Search/Results?lookfor=",
         ddg: "https://duckduckgo.com/?q=",
         // Add more bangs as needed
     };

     if (bangCommand) {
         const parts = query.split(' ');
         const command = parts[0].substring(1).toLowerCase();
         const searchQuery = parts.slice(1).join(' ');

         if (bangRedirects[command] && searchQuery) { // Ensure there's a search query after bang
             return bangRedirects[command] + encodeURIComponent(searchQuery);
         } else if (bangRedirects[command] && !searchQuery) {
             // Handle bangs that go to a homepage, e.g., !github
             const homepageUrl = bangRedirects[command].split('?')[0]; // Basic homepage extraction
             if (homepageUrl && homepageUrl.startsWith('http')) return homepageUrl;
         }
     }
     return null;
}


// --- Main Search Route ---
app.get('/search', async (req, res) => {
    const startTime = Date.now();
    const query = req.query.query?.trim() || req.query.q?.trim() || '';
    const type = req.query.type || 'web'; // Default to web
    // Ensure start is a non-negative integer, default to 0 for logic
    const start = Math.max(0, parseInt(req.query.start) || 0);
    // Source parameter removed for simplification, logic now driven by 'type'

    // Handle Empty Query
    if (!query) {
        // Redirect to homepage or render a message
        return res.redirect('/');
    }

    // Handle Bang Redirects first
    const bangRedirect = checkBangRedirects(query);
    if (bangRedirect) {
        return res.redirect(bangRedirect);
    }

    // Basic IP/Country Info (Optional)
    let countryCode = 'N/A';
    if (IPINFO_TOKEN) {
        try {
             const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '8.8.8.8';
             // Small optimization: Cache IP lookup results briefly
             const ipCacheKey = `ipinfo_${ip}`;
             let geoData = Cache.get(ipCacheKey);
             if (!geoData) {
                 const response = await axios.get(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`, { timeout: 1500 });
                 geoData = response.data;
                 Cache.set(ipCacheKey, geoData); // Cache successful lookup
             }
             countryCode = geoData.country || 'N/A';
        } catch (error) {
             console.error("IP Info fetch error:", error.message);
             // Don't block search if IP info fails
        }
    }


    // Prepare data object for the template
    const renderData = {
        query,
        type,
        start, // Pass the 0-based start index
        results: [],
        images: [],
        newsResults: [],
        videos: [],
        wiki: null,
        countryCode,
        elapsedTime: 0,
        searchSource: 'Synapic Search' // Generic source name
    };

    try {
        // Fetch data based on type
        const fetchPromises = [];

        // Always try fetching Wiki for context (quick)
        fetchPromises.push(fetchWikiSummary(query, 'tr').catch(e => { console.error("Wiki fetch failed inline:", e.message); return null; })); // Add catch here

        switch (type) {
            case 'web':
                fetchPromises.push(getAggregatedWebResults(query, start).catch(e => { console.error("Web fetch failed inline:", e.message); return []; })); // Add catch here
                renderData.searchSource = 'Web Results';
                break;
            case 'image':
                fetchPromises.push(fetchBingImages(query).catch(e => { console.error("Image fetch failed inline:", e.message); return []; })); // Add catch here
                renderData.searchSource = 'Image Results';
                break;
            case 'news':
                 // Using Google News fetch now
                fetchPromises.push(fetchGoogleNewsResults(query, start).catch(e => { console.error("News fetch failed inline:", e.message); return []; })); // Add catch here
                renderData.searchSource = 'News Results';
                break;
            case 'wiki':
                // Wiki is already fetched, no extra fetch needed
                renderData.searchSource = 'Wikipedia Result';
                break;
            case 'video':
                fetchPromises.push(fetchYoutubeResults(query).catch(e => { console.error("Video fetch failed inline:", e.message); return []; })); // Add catch here
                renderData.searchSource = 'Video Results';
                break;
            default:
                // Fallback to web if type is unknown
                fetchPromises.push(getAggregatedWebResults(query, start).catch(e => { console.error("Web fallback fetch failed inline:", e.message); return []; })); // Add catch here
                renderData.type = 'web'; // Correct the type
                renderData.searchSource = 'Web Results';
        }

        // Execute fetches concurrently
        const [wikiResult, mainResults] = await Promise.all(fetchPromises);

        renderData.wiki = wikiResult;

        // Assign results to the correct property based on type
        switch (type) {
            case 'web': renderData.results = mainResults || []; break;
            case 'image': renderData.images = mainResults || []; break;
            case 'news': renderData.newsResults = mainResults || []; break;
            // case 'wiki': // No main results specific to wiki type alone
            case 'video': renderData.videos = mainResults || []; break;
            default: renderData.results = mainResults || []; // Assign to web results on fallback
        }

    } catch (error) {
        // Catch errors from Promise.all or other synchronous code
        console.error("Error during search processing:", error.message);
        // Render with potentially empty results but avoid crashing
        renderData.searchSource = 'Error retrieving results';
    } finally {
        // Calculate time and render
        renderData.elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        res.render('results', renderData); // Use your new theme file 'results.ejs'
    }
});


// --- API Key Check Middleware ---
function checkApiKey(req, res, next) {
    const apiKey = req.query.apikey;
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(403).json({ error: "Geçersiz veya eksik API anahtarı" });
    }
    next();
}

// --- API Endpoint --- (Refactored similarly to /search)
app.get('/api/search', checkApiKey, async (req, res) => {
     const query = req.query.query?.trim() || req.query.q?.trim();
     const type = req.query.type || 'web';
     const start = Math.max(0, parseInt(req.query.start) || 0);
     // Source parameter could be added back here if needed for API differentiation

     if (!query) return res.status(400).json({ error: "Arama sorgusu eksik!" });

     try {
        let results = [], images = [], newsResults = [], videos = [];
        let searchSource = '';
        const wiki = await fetchWikiSummary(query, 'tr'); // Fetch wiki for API too

        // Fetch based on type
        switch (type) {
            case 'web':
                results = await getAggregatedWebResults(query, start);
                searchSource = 'Aggregated Web';
                break;
            case 'image':
                images = await fetchBingImages(query);
                searchSource = 'Bing Images';
                break;
            case 'news':
                newsResults = await fetchGoogleNewsResults(query, start);
                searchSource = 'Google News';
                break;
            case 'wiki':
                // Wiki already fetched
                searchSource = 'Wikipedia';
                break;
            case 'video':
                videos = await fetchYoutubeResults(query);
                searchSource = 'YouTube Videos';
                break;
            default: // Fallback to web
                results = await getAggregatedWebResults(query, start);
                searchSource = 'Aggregated Web';
                type = 'web'; // Correct type for response
        }

        res.json({
            query,
            type,
            searchSource,
            wiki, // Include wiki in API response
            results,
            images,
            newsResults,
            videos
        });

     } catch (error) {
        console.error("API Search Error:", error.message);
        res.status(500).json({ error: "Arama sırasında bir sunucu hatası oluştu." });
     }
});


// --- Other Routes ---
app.get('/', (req, res) => res.render('index')); // Assuming you have an index.ejs
app.get('/manifesto', (req, res) => res.render('manifesto')); // Assuming manifesto.ejs
app.get('/iletisim', (req, res) => res.render('iletisim', { messageSent: false })); // Assuming iletisim.ejs

// --- Engine Redirect Routes --- (Simplified, use bangs or direct search)
// These might be less necessary now with bangs and type parameter
// You can keep them if you want direct URLs like /google?q=...
app.get('/google', (req, res) => {
    const query = req.query.q || '';
    res.redirect(`/search?query=${encodeURIComponent(query)}&type=web`); // Default to web type
});
app.get('/bing', (req, res) => {
    const query = req.query.q || '';
    res.redirect(`/search?query=${encodeURIComponent(query)}&type=web`);
});
// Remove Yahoo/YouTube specific redirects if using bangs/type primarily
// app.get('/yahoo', (req, res) => { ... });
// app.get('/youtube', (req, res) => { ... });


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Synapic Search sunucusu çalışıyor: http://localhost:${PORT}`);
    // Clean up expired cache items periodically (optional)
    setInterval(() => {
        const now = Date.now();
        for (const [key, item] of cacheStorage.entries()) {
            if (item.expiry < now) {
                cacheStorage.delete(key);
            }
        }
         // console.log(`Cache cleanup executed. Size: ${cacheStorage.size}`);
    }, cacheExpiration); // Run cleanup every cache cycle
});

// Note: fetchGoogleApiResults, fetchYahooResults functions were removed for brevity
// as the main focus was on fixing scraping and integrating with the new theme.
// You can add them back if needed, using similar caching and conditional logic.
