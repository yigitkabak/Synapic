Require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 3000;
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;


const validApiKeys = require('./views/json/ApiKeys.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));


const cacheStorage = new Map();
const cacheExpiration = 15 * 60 * 1000;

const Cache = {
    get: function(key) {
        const cacheItem = cacheStorage.get(key);
        if (cacheItem && cacheItem.expiry > Date.now()) {

            return cacheItem.data;
        }

        cacheStorage.delete(key);
        return null;
    },
    set: function(key, data) {

        if (!data || (Array.isArray(data) && data.length === 0)) {


             return;
        }
        cacheStorage.set(key, {
            data,
            expiry: Date.now() + cacheExpiration
        });
    }
};


const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';



async function fetchWikiSummary(query, lang = 'tr') {
    const cacheKey = `wiki_${lang}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': `${lang}-${lang.toUpperCase()},${lang};q=0.9` },
            timeout: 5000
        });

        const wikiData = {
            title: data.title,
            summary: data.extract,
            img: data.thumbnail?.source || null,
            url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(query)}`,

        };
        Cache.set(cacheKey, wikiData);
        return wikiData;
    } catch (error) {

        if (error.response?.status === 404) {
            Cache.set(cacheKey, null);
        }
        return null;
    }
}


async function fetchGoogleResults(query, start = 0) {
    const cacheKey = `google_web_${start}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&hl=tr&gl=tr`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const results = [];


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
                    } catch (e) { }
                 }

                 results.push({
                    title,
                    link: url,
                    snippet,
                    displayUrl: displayUrl || new URL(url).hostname,
                    source: 'Google'

                });
            }
        });

        Cache.set(cacheKey, results);
        return results.slice(0, 10);
    } catch (error) {
        console.error('Google fetch error:', error.message);
        return [];
    }
}


async function fetchBingResults(query, start = 0) {

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
            const snippetNode = $(element).find('.b_caption p');
            const snippet = snippetNode.text() || '';
            const displayUrl = $(element).find('cite').text() || '';

            if (title && url) {
                results.push({
                    title,
                    link: url,
                    snippet,
                    displayUrl: displayUrl || new URL(url).hostname,
                    source: 'Bing'
                });
            }
        });

        Cache.set(cacheKey, results);
        return results.slice(0, 10);
    } catch (error) {
        console.error('Bing fetch error:', error.message);
        return [];
    }
}


async function fetchGoogleNewsResults(query, start = 0) {
    const cacheKey = `google_news_${start}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {

        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&start=${start}&hl=tr&gl=tr`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 7000
        });

        const $ = cheerio.load(data);
        const newsResults = [];


        $('a[jsname][href]').closest('div.SoaBEf').each((_, element) => {
            const linkElement = $(element).find('a[jsname][href]');
            let url = linkElement.attr('href');
            const title = $(element).find('div[role="heading"]').text() || '';
            const snippet = $(element).find('div.GI74Re').text() || '';
            const sourceAndTime = $(element).find('div.XTjFC.WF4CUc').text() || '';
            const imageElement = $(element).find('img.wFSVIb');
            const image = imageElement.attr('src');

            if (url && title) {

                if (url.startsWith('/url?q=')) {
                   try {
                       const parsedUrl = new URLSearchParams(url.split('?')[1]);
                       url = parsedUrl.get('q') || url;
                   } catch (e) { }
                }


                const source = sourceAndTime.split('·')[0]?.trim() || 'Unknown Source';

                newsResults.push({
                    news: title,
                    link: url,
                    snippet: snippet,
                    source: source,
                    image: image || null
                });
            }
        });

        Cache.set(cacheKey, newsResults);
        return newsResults.slice(0, 12);
    } catch (error) {
        console.error('Google News fetch error:', error.message);
        return [];
    }
}



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


        $('li.dg_u, div.imgpt, div.dgControl.hover').each((_, el) => {
            if (count >= 30) return false;


            const jsonData = $(el).find('a.iusc').attr('m');
            if (jsonData) {
                try {
                    const imgData = JSON.parse(jsonData);
                    const murl = imgData.murl;
                    const turl = imgData.turl;
                    const title = imgData.t;

                    if (murl || turl) {
                        images.push({
                            image: murl || turl,
                            thumbnail: turl,
                            title: title || query,
                            link: imgData.purl || '#'
                        });
                        count++;
                    }
                } catch (e) {

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
    } catch (err) {
        console.error('Bing images fetch error:', err.message);
        return [];
    }
}


async function fetchYoutubeResults(query) {
    const cacheKey = `youtube_videos_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {

        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=tr&gl=TR`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'tr-TR,tr;q=0.9' },
            timeout: 8000
        });

        const $ = cheerio.load(data);
        const videos = [];


        let initialData = null;
        $('script').each((_, script) => {
            const scriptContent = $(script).html();
            if (scriptContent?.includes('var ytInitialData = ')) {
                try {
                    const jsonData = scriptContent.split('var ytInitialData = ')[1].split(';</script>')[0];
                    initialData = JSON.parse(jsonData);
                    return false;
                } catch (e) {
                    console.error("Failed to parse ytInitialData", e.message);
                }
            }
        });

        if (initialData) {

            const contents = initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            const itemSection = contents?.find(c => c.itemSectionRenderer)?.itemSectionRenderer?.contents;

            if (itemSection) {
                itemSection.forEach(item => {
                    const videoRenderer = item.videoRenderer;
                    if (videoRenderer) {
                        const videoId = videoRenderer.videoId;
                        const title = videoRenderer.title?.runs?.[0]?.text || 'N/A';

                        const thumbnail = videoRenderer.thumbnail?.thumbnails?.sort((a, b) => b.width - a.width)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                        const channel = videoRenderer.ownerText?.runs?.[0]?.text || 'N/A';


                        if (videoId && title) {
                            videos.push({
                                title,
                                url: `https://www.youtube.com/watch?v=${videoId}`,
                                thumbnail: thumbnail,
                                source: channel
                            });
                        }
                    }
                });
            }
        } else {

             console.warn("Falling back to basic YouTube selectors.");
             $('ytd-video-renderer').each((_, element) => {
                 const titleElement = $(element).find('#video-title');
                 const title = titleElement.text().trim();
                 const url = 'https://www.youtube.com' + titleElement.attr('href');
                 const videoId = url.split('v=')[1]?.split('&')[0];

                 const thumbnailElement = $(element).find('#img');
                 const thumbnail = thumbnailElement.attr('src');
                 const channelElement = $(element).find('#channel-name a');
                 const channel = channelElement.text().trim();

                 if (title && url && url.includes('/watch?v=')) {
                     videos.push({
                         title,
                         url,
                         thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                         source: channel || 'YouTube'
                     });
                 }
             });
        }


        Cache.set(cacheKey, videos);
        return videos.slice(0, 12);
    } catch (error) {
        console.error('YouTube fetch error:', error.message);
        return [];
    }
}


async function getAggregatedWebResults(query, start = 0) {
    const cacheKey = `aggregated_web_${start}_${query}`;
    const cachedData = Cache.get(cacheKey);
    if (cachedData) return cachedData;

    try {

        const [googleResults, bingResults] = await Promise.all([
            fetchGoogleResults(query, start),
            fetchBingResults(query, start)
        ]);


        const resultsMap = new Map();
        googleResults.forEach(item => resultsMap.set(item.link, item));
        bingResults.forEach(item => {
            if (!resultsMap.has(item.link)) {
                resultsMap.set(item.link, item);
            }
        });

        const combined = Array.from(resultsMap.values());
        Cache.set(cacheKey, combined);
        return combined.slice(0, 10);

    } catch (error) {
        console.error('Aggregated search error:', error.message);
        return [];
    }
}



function checkBangRedirects(query) {
     const bangCommand = query.startsWith('!') ? query.substring(1).trim().toLowerCase() : null;
     const bangRedirects = {
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

     if (bangCommand) {
         const parts = query.split(' ');
         const command = parts[0].substring(1).toLowerCase();
         const searchQuery = parts.slice(1).join(' ');

         if (bangRedirects[command] && searchQuery) {
             return bangRedirects[command] + encodeURIComponent(searchQuery);
         } else if (bangRedirects[command] && !searchQuery) {

             const homepageUrl = bangRedirects[command].split('?')[0];
             if (homepageUrl && homepageUrl.startsWith('http')) return homepageUrl;
         }
     }
     return null;
}



app.get('/search', async (req, res) => {
    const startTime = Date.now();
    const query = req.query.query?.trim() || req.query.q?.trim() || '';
    const type = req.query.type || 'web';

    const start = Math.max(0, parseInt(req.query.start) || 0);



    if (!query) {

        return res.redirect('/');
    }


    const bangRedirect = checkBangRedirects(query);
    if (bangRedirect) {
        return res.redirect(bangRedirect);
    }


    let countryCode = 'N/A';
    if (IPINFO_TOKEN) {
        try {
             const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '8.8.8.8';

             const ipCacheKey = `ipinfo_${ip}`;
             let geoData = Cache.get(ipCacheKey);
             if (!geoData) {
                 const response = await axios.get(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`, { timeout: 1500 });
                 geoData = response.data;
                 Cache.set(ipCacheKey, geoData);
             }
             countryCode = geoData.country || 'N/A';
        } catch (error) {
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
        elapsedTime: 0,
        searchSource: 'Synapic Search'
    };

    try {

        const fetchPromises = [];


        fetchPromises.push(fetchWikiSummary(query, 'tr').catch(e => { console.error("Wiki fetch failed inline:", e.message); return null; }));

        switch (type) {
            case 'web':
                fetchPromises.push(getAggregatedWebResults(query, start).catch(e => { console.error("Web fetch failed inline:", e.message); return []; }));
                renderData.searchSource = 'Web Results';
                break;
            case 'image':
                fetchPromises.push(fetchBingImages(query).catch(e => { console.error("Image fetch failed inline:", e.message); return []; }));
                renderData.searchSource = 'Image Results';
                break;
            case 'news':

                fetchPromises.push(fetchGoogleNewsResults(query, start).catch(e => { console.error("News fetch failed inline:", e.message); return []; }));
                renderData.searchSource = 'News Results';
                break;
            case 'wiki':

                renderData.searchSource = 'Wikipedia Result';
                break;
            case 'video':
                fetchPromises.push(fetchYoutubeResults(query).catch(e => { console.error("Video fetch failed inline:", e.message); return []; }));
                renderData.searchSource = 'Video Results';
                break;
            default:

                fetchPromises.push(getAggregatedWebResults(query, start).catch(e => { console.error("Web fallback fetch failed inline:", e.message); return []; }));
                renderData.type = 'web';
                renderData.searchSource = 'Web Results';
        }


        const [wikiResult, mainResults] = await Promise.all(fetchPromises);

        renderData.wiki = wikiResult;


        switch (type) {
            case 'web': renderData.results = mainResults || []; break;
            case 'image': renderData.images = mainResults || []; break;
            case 'news': renderData.newsResults = mainResults || []; break;

            case 'video': renderData.videos = mainResults || []; break;
            default: renderData.results = mainResults || [];
        }

    } catch (error) {

        console.error("Error during search processing:", error.message);

        renderData.searchSource = 'Error retrieving results';
    } finally {

        renderData.elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        res.render('results', renderData);
    }
});



function checkApiKey(req, res, next) {
    const apiKey = req.query.apikey;
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(403).json({ error: "Geçersiz veya eksik API anahtarı" });
    }
    next();
}


app.get('/api/search', checkApiKey, async (req, res) => {
     const query = req.query.query?.trim() || req.query.q?.trim();
     const type = req.query.type || 'web';
     const start = Math.max(0, parseInt(req.query.start) || 0);


     if (!query) return res.status(400).json({ error: "Arama sorgusu eksik!" });

     try {
        let results = [], images = [], newsResults = [], videos = [];
        let searchSource = '';
        const wiki = await fetchWikiSummary(query, 'tr');


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

                searchSource = 'Wikipedia';
                break;
            case 'video':
                videos = await fetchYoutubeResults(query);
                searchSource = 'YouTube Videos';
                break;
            default:
                results = await getAggregatedWebResults(query, start);
                searchSource = 'Aggregated Web';
                type = 'web';
        }

        res.json({
            query,
            type,
            searchSource,
            wiki,
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




app.listen(PORT, () => {
    console.log(`Synapic Search sunucusu çalışıyor: http://localhost:${PORT}`);

    setInterval(() => {
        const now = Date.now();
        for (const [key, item] of cacheStorage.entries()) {
            if (item.expiry < now) {
                cacheStorage.delete(key);
            }
        }

    }, cacheExpiration);
});
