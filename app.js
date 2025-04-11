const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

const validApiKeys = require('./views/json/ApiKeys.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('public'));

// API key kontrolü
function checkApiKey(req, res, next) {
    const apiKey = req.query.apikey;
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(403).json({ error: "Geçersiz veya eksik API anahtarı" });
    }
    next();
}

// Wikipedia özelliği
async function fetchWikiSummary(query, lang = 'tr') {
    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': `${lang}-${lang.toUpperCase()},${lang};q=0.9`
            }
        });

        return {
            title: data.title,
            summary: data.extract,
            img: data.thumbnail?.source || null,
            url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${query}`,
            category: data.description || 'Vikipedi'
        };
    } catch (error) {
        console.error("Wikipedia fetch error:", error.message);
        return null;
    }
}

// Bing sonuçları
async function fetchBingResults(query) {
    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=tr&cc=tr&mkt=tr-TR`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'tr-TR,tr;q=0.9'
            }
        });

        const $ = cheerio.load(data);
        const results = [], images = [], newsResults = [];

        $('li.b_algo').each((_, el) => {
            const title = $(el).find('h2').text();
            const link = $(el).find('h2 a').attr('href');
            const snippet = $(el).find('.b_caption p').text();
            const isTurkishDomain = link && (link.includes('.tr/') || link.endsWith('.tr'));
            const hasTurkishChars = (title + snippet).match(/[çğıöşüÇĞİÖŞÜ]/g);
            if (title && link && (isTurkishDomain || hasTurkishChars)) {
                results.push({ title, link, snippet, rating: Math.floor(Math.random() * 10) + 1, source: 'Bing' });
            }
        });

        $('.imgpt').each((_, el) => {
            const link = $(el).find('a').attr('href');
            const imgSrc = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
            const imgAlt = $(el).find('img').attr('alt') || '';
            const isTurkishDomain = link && (link.includes('.tr/') || link.endsWith('.tr'));
            const hasTurkishChars = imgAlt.match(/[çğıöşüÇĞİÖŞÜ]/g);
            if (link && imgSrc && (isTurkishDomain || hasTurkishChars)) {
                images.push({ link, image: imgSrc });
            }
        });

        $('.cico').each((_, el) => {
            const newsContainer = $(el).closest('.b_algo');
            const newsTitle = newsContainer.find('h2').text();
            const link = newsContainer.find('h2 a').attr('href');
            const imgSrc = $(el).find('img').attr('src');
            const isTurkishDomain = link && (link.includes('.tr/') || link.endsWith('.tr'));
            const hasTurkishChars = newsTitle.match(/[çğıöşüÇĞİÖŞÜ]/g);
            if (newsTitle && link && (isTurkishDomain || hasTurkishChars)) {
                newsResults.push({ news: newsTitle, link, image: imgSrc || null });
            }
        });

        return { results, images, newsResults };
    } catch (err) {
        console.error('Bing fetch error:', err.message);
        return { results: [], images: [], newsResults: [] };
    }
}

// Google API
async function fetchGoogleResults(query, searchType = 'web') {
    try {
        const params = {
            key: 'AIzaSyDJsSgqZNQtWE1HH-RIRFZWIETuskgVVXo',
            cx: '14186417efcac49f0',
            q: query,
            cr: 'countryTR',
            gl: 'tr',
            hl: 'tr'
        };

        if (searchType === 'image') {
            params.searchType = 'image';
        }

        const searchResponse = await axios.get('https://www.googleapis.com/customsearch/v1', { params });
        const items = searchResponse.data.items || [];

        const results = items.map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            rating: Math.floor(Math.random() * 10) + 1,
            source: 'Google'
        }));

        const images = (searchType === 'image') 
            ? items.map(item => ({ link: item.link, image: item.link, title: item.title }))
            : items.filter(i => i.pagemap?.cse_image).map(i => ({
                link: i.link,
                image: i.pagemap.cse_image[0]?.src || null,
                title: i.title
            }));

        const newsResults = items.map(item => ({
            news: item.pagemap?.newsarticle?.[0]?.headline || item.title,
            link: item.link,
            image: item.pagemap?.cse_image?.[0]?.src || null
        })).filter(item => item.news);

        return { results, images, newsResults };
    } catch (error) {
        console.error('Google API error:', error.message);
        return { results: [], images: [], newsResults: [] };
    }
}

// Bang yönlendirme
function checkBangRedirects(query) {
    const bangCommand = query.startsWith('!') ? query.substring(1).trim().toLowerCase() : null;
    const bangRedirects = {
        github: "https://github.com",
        gh: "https://github.com",
        google: "https://www.google.com",
        yt: "https://www.youtube.com",
        wikipedia: "https://www.wikipedia.org",
        wp: "https://www.wikipedia.org",
        // diğerleri...
    };
    return bangCommand ? bangRedirects[bangCommand] || null : null;
}

// Arama rotası
app.get('/search', async (req, res) => {
    const startTime = Date.now();
    let query = req.query.query?.trim() || req.query.q?.trim() || '';
    const type = req.query.type || 'web';
    const start = parseInt(req.query.start) || 1;

    const bangRedirect = checkBangRedirects(query);
    if (bangRedirect) return res.redirect(bangRedirect);

    let countryCode = 'N/A';
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '8.8.8.8';
        const response = await axios.get(`https://ipinfo.io/${ip}?token=c621d5706831cd`);
        countryCode = response.data.country || 'N/A';
    } catch (error) {
        console.error(error.message);
    }

    try {
        let results = [], images = [], newsResults = [], searchSource = '';
        const wiki = await fetchWikiSummary(query, 'tr');

        // Google ve Bing sonuçlarını alıyoruz
        const bingData = await fetchBingResults(query);
        const googleData = await fetchGoogleResults(query);

        // Bing sonuçlarını al
        results = bingData.results;
        newsResults = bingData.newsResults;
        images = [...images, ...bingData.images]; // Bing görsellerini de ekle

        // Google sonuçlarını al
        results = [...results, ...googleData.results]; // Google sonuçları Bing sonuçlarına ekleniyor
        newsResults = [...newsResults, ...googleData.newsResults]; // Google news sonuçları Bing news'e ekleniyor
        images = [...images, ...googleData.images]; // Google görselleri de Bing görsellerine ekleniyor

        searchSource = 'Bing & Google'; // Kaynak olarak her iki arama motoru belirtiliyor

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        res.render('results', { query, type, results, images, newsResults, wiki, countryCode, elapsedTime, start, searchSource });
    } catch (error) {
        console.error(error.message);
        res.render('results', { query, type, results: [], images: [], newsResults: [], wiki: null, countryCode, elapsedTime: 0, start, searchSource: 'Error' });
    }
});

// API endpoint
app.get('/api/search', checkApiKey, async (req, res) => {
    const query = req.query.query || req.query.q;
    const type = req.query.type || 'web';
    if (!query) return res.status(400).json({ error: "Arama sorgusu eksik!" });

    try {
        let results = [], images = [], newsResults = [], searchSource = '';
        const wiki = await fetchWikiSummary(query, 'tr');

        // Google ve Bing sonuçlarını alıyoruz
        const bingData = await fetchBingResults(query);
        const googleData = await fetchGoogleResults(query);

        // Bing sonuçlarını al
        results = bingData.results;
        newsResults = bingData.newsResults;
        images = [...images, ...bingData.images]; // Bing görsellerini de ekle

        // Google sonuçlarını al
        results = [...results, ...googleData.results]; // Google sonuçları Bing sonuçlarına ekleniyor
        newsResults = [...newsResults, ...googleData.newsResults]; // Google news sonuçları Bing news'e ekleniyor
        images = [...images, ...googleData.images]; // Google görselleri de Bing görsellerine ekleniyor

        searchSource = 'Bing & Google'; // Kaynak olarak her iki arama motoru belirtiliyor

        res.json({ results, images, newsResults, wiki, searchSource, type });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Bir hata oluştu." });
    }
});

// Diğer sayfalar
app.get('/', (req, res) => res.render('index'));
app.get('/manifesto', (req, res) => res.render('manifesto'));
app.get('/iletisim', (req, res) => res.render('iletisim', { messageSent: false }));

app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});