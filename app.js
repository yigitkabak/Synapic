const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Load API keys from file
const validApiKeys = require('./views/json/ApiKeys.json');

// Setup middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));

// API key middleware
function checkApiKey(req, res, next) {
    const apiKey = req.query.apikey;
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(403).json({ error: "Geçersiz veya eksik API anahtarı" });
    }
    next();
}

// Fetch Bing search results
async function fetchBingResults(query) {
    try {
        // Add Turkish language and region parameters
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=tr&cc=tr&mkt=tr-TR`;
        
        const { data } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'tr-TR,tr;q=0.9'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];

        // Filter for Turkish domains or content
        $('li.b_algo').each((_, el) => {
            const title = $(el).find('h2').text();
            const link = $(el).find('h2 a').attr('href');
            const snippet = $(el).find('.b_caption p').text();
            
            // Check if the domain is Turkish (.tr) or content seems Turkish
            const isTurkishDomain = link && (link.includes('.tr/') || link.includes('.tr"') || link.endsWith('.tr'));
            const hasTurkishChars = (title + snippet).match(/[çğıöşüÇĞİÖŞÜ]/g);
            
            if (title && link && (isTurkishDomain || hasTurkishChars)) {
                results.push({ 
                    title, 
                    link, 
                    snippet, 
                    rating: Math.floor(Math.random() * 10) + 1,
                    source: 'Bing'
                });
            }
        });

        // Extract images - filter for Turkish content
        const images = [];
        $('.imgpt').each((_, el) => {
            const link = $(el).find('a').attr('href');
            const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
            const imgAlt = $(el).find('img').attr('alt') || '';
            
            // Check if image alt text or link has Turkish characters or domain
            const isTurkishDomain = link && (link.includes('.tr/') || link.includes('.tr"') || link.endsWith('.tr'));
            const hasTurkishChars = imgAlt.match(/[çğıöşüÇĞİÖŞÜ]/g);
            
            if (link && imgSrc && (isTurkishDomain || hasTurkishChars)) {
                images.push({
                    link,
                    image: imgSrc
                });
            }
        });

        // Extract shopping results - filter for Turkish content
        const shoppingResults = [];
        $('.cico').each((_, el) => {
            const productContainer = $(el).closest('.b_algo');
            const productTitle = productContainer.find('h2').text();
            const link = productContainer.find('h2 a').attr('href');
            const imgSrc = $(el).find('img').attr('src');
            
            // Check if product info has Turkish characters or domain
            const isTurkishDomain = link && (link.includes('.tr/') || link.includes('.tr"') || link.endsWith('.tr'));
            const hasTurkishChars = productTitle.match(/[çğıöşüÇĞİÖŞÜ]/g);
            
            if (productTitle && link && (isTurkishDomain || hasTurkishChars)) {
                shoppingResults.push({
                    product: productTitle,
                    link,
                    image: imgSrc || null
                });
            }
        });

        return { results, images, shoppingResults };
    } catch (err) {
        console.error('Bing fetch error:', err.message);
        return { results: [], images: [], shoppingResults: [] };
    }
}

// Fetch Google search results using API
async function fetchGoogleResults(query, searchType = 'web') {
    try {
        const params = { 
            key: 'AIzaSyDJsSgqZNQtWE1HH-RIRFZWIETuskgVVXo', 
            cx: '14186417efcac49f0', 
            q: query,
            cr: 'countryTR',  // Restrict to Turkey
            gl: 'tr',         // Set geographic location to Turkey
            hl: 'tr'          // Set interface language to Turkish
        };
        
        // If specifically searching for images, add image search parameters
        if (searchType === 'image') {
            params.searchType = 'image';
        }
        
        const searchResponse = await axios.get('https://www.googleapis.com/customsearch/v1', { params });

        const results = (searchResponse.data.items || []).map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            rating: Math.floor(Math.random() * 10) + 1,
            source: 'Google'
        }));

        // Process images differently based on whether it's an image search or regular search
        let images = [];
        if (searchType === 'image') {
            // For dedicated image search
            images = (searchResponse.data.items || []).map(item => ({
                link: item.link,
                image: item.link,
                title: item.title
            }));
        } else {
            // For regular search with images in pagemap
            images = (searchResponse.data.items || [])
                .filter(item => item.pagemap?.cse_image)
                .map(item => ({
                    link: item.link,
                    image: item.pagemap.cse_image[0]?.src || null,
                    title: item.title
                }));
        }

        const shoppingResults = (searchResponse.data.items || [])
            .map(item => ({
                product: item.pagemap?.product?.[0]?.name || item.title,
                link: item.link,
                image: item.pagemap?.cse_image?.[0]?.src || null
            }))
            .filter(item => item.product);

        return { results, images, shoppingResults };
    } catch (error) {
        console.error('Google API error:', error.message);
        return { results: [], images: [], shoppingResults: [] };
    }
}

// Check for bang redirects
function checkBangRedirects(query) {
    if (query.startsWith('!')) {
        const bangCommand = query.substring(1).trim().toLowerCase();
        const bangRedirects = {
            github: "https://github.com",
            gh: "https://github.com",
            google: "https://www.google.com",
            ph: "https://www.pornhub.com",
            youtube: "https://www.youtube.com",
            yt: "https://www.youtube.com",
            reddit: "https://www.reddit.com",
            stackoverflow: "https://stackoverflow.com",
            so: "https://stackoverflow.com",
            wikipedia: "https://www.wikipedia.org",
            wp: "https://www.wikipedia.org",
            amazon: "https://www.amazon.com",
            imdb: "https://www.imdb.com",
            twitter: "https://twitter.com",
            fb: "https://facebook.com",
            instagram: "https://www.instagram.com",
            linkedin: "https://www.linkedin.com",
            pinterest: "https://www.pinterest.com",
            tiktok: "https://www.tiktok.com",
            githubissues: "https://github.com/issues",
            news: "https://news.google.com",
            map: "https://maps.google.com",
            spotify: "https://www.spotify.com",
            slack: "https://slack.com",
            discord: "https://discord.com",
            dc: "https://discord.com",
            medium: "https://medium.com",
            vimeo: "https://vimeo.com",
            whatsapp: "https://www.whatsapp.com",
            quora: "https://www.quora.com",
            snapchat: "https://www.snapchat.com"
        };
        
        return bangRedirects[bangCommand] || null;
    }
    return null;
}

// Main search route
app.get('/search', async (req, res) => {
    const startTime = Date.now();
    let query = req.query.query?.trim() || req.query.q?.trim() || '';
    const type = req.query.type || 'web';
    const start = parseInt(req.query.start) || 1;

    // Check for bang redirects
    const bangRedirect = checkBangRedirects(query);
    if (bangRedirect) {
        return res.redirect(bangRedirect);
    }

    // Get country code from IP
    let countryCode = 'N/A';
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '8.8.8.8';
        const response = await axios.get(`https://ipinfo.io/${ip}?token=c621d5706831cd`);
        countryCode = response.data.country || 'N/A';
    } catch (error) {
        console.error(error.message);
    }

    try {
        let results = [];
        let images = [];
        let shoppingResults = [];
        let searchSource = '';
        
        // For image search, always use Google Custom Search API
        if (type === 'image') {
            const googleData = await fetchGoogleResults(query);
            images = googleData.images;
            searchSource = 'Google';
        } else {
            // For web search, try Bing first then fall back to Google
            const bingData = await fetchBingResults(query);
            results = bingData.results;
            shoppingResults = bingData.shoppingResults;
            searchSource = 'Bing';
            
            // If Bing returns no results, fall back to Google
            if (results.length === 0) {
                const googleData = await fetchGoogleResults(query);
                results = googleData.results;
                shoppingResults = googleData.shoppingResults;
                searchSource = 'Google';
            }
            
            // Always get images from Google Custom Search API
            const googleData = await fetchGoogleResults(query);
            images = googleData.images;
        }

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        res.render('results', { 
            query, 
            type, 
            results, 
            images, 
            shoppingResults, 
            countryCode, 
            elapsedTime, 
            start,
            searchSource 
        });
    } catch (error) {
        console.error(error.message);
        res.render('results', { 
            query, 
            type, 
            results: [], 
            images: [], 
            shoppingResults: [], 
            countryCode, 
            elapsedTime: 0, 
            start,
            searchSource: 'Error' 
        });
    }
});

// API endpoint for search
app.get('/api/search', checkApiKey, async (req, res) => {
    const query = req.query.query || req.query.q;
    const type = req.query.type || 'web';
    if (!query) return res.status(400).json({ error: "Arama sorgusu eksik!" });

    try {
        let results = [];
        let images = [];
        let shoppingResults = [];
        let searchSource = '';
        
        // For image search, always use Google Custom Search API
        if (type === 'image') {
            const googleData = await fetchGoogleResults(query);
            images = googleData.images;
            searchSource = 'Google';
        } else {
            // For web search, try Bing first then fall back to Google
            const bingData = await fetchBingResults(query);
            results = bingData.results;
            shoppingResults = bingData.shoppingResults;
            searchSource = 'Bing';
            
            // If Bing returns no results, fall back to Google
            if (results.length === 0) {
                const googleData = await fetchGoogleResults(query);
                results = googleData.results;
                shoppingResults = googleData.shoppingResults;
                searchSource = 'Google';
            }
            
            // Always get images from Google Custom Search API
            const googleData = await fetchGoogleResults(query);
            images = googleData.images;
        }

        res.json({ results, images, shoppingResults, searchSource, type });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Bir hata oluştu." });
    }
});

// Home page
app.get('/', (req, res) => {
    res.render('index');
});

// Additional pages
app.get('/manifesto', (req, res) => {
    res.render('manifesto');
});

app.get('/iletisim', (req, res) => {
    res.render('iletisim', { messageSent: false });
});

app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
