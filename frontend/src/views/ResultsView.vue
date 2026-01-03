<template>
  <div class="app-container">
    <header class="main-header">
      <a href="/" class="brand-logo">Synapic</a>
      <div class="header-actions">
        <button aria-label="Grid view" class="icon-button" @click="openOverlay('gridView')">
          <i class="fas fa-th-large"></i>
        </button>
        <button aria-label="Menu" class="icon-button" @click="openOverlay('controlCenter')">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </header>

    <main class="main-content">
      <div class="search-bar-container">
        <form aria-label="Search form" class="search-form" @submit.prevent="handleSearch">
          <label class="sr-only" for="search-results">Search</label>
          <div class="search-input-wrapper">
            <input 
              class="search-input"
              id="search-results" 
              name="query" 
              placeholder="Let's get it ..."
              type="search" 
              v-model="searchQuery"
              @focus="showHistory = true"
              @blur="handleBlur"
              autocomplete="off"
            />
            <button type="button" class="clear-search-button" v-if="searchQuery.length > 0" @click="clearSearch">
              <i class="fas fa-times"></i>
            </button>
            <div class="search-separator"></div>
            <button aria-label="Search" class="search-submit-button" type="submit">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </form>

        <div class="search-history-dropdown" v-if="showHistory && searchHistory.length > 0">
          <div class="history-content">
            <h3 class="history-title">Recent Searches</h3>
            <div class="history-list">
              <div 
                v-for="(item, index) in searchHistory" 
                :key="index" 
                class="history-item"
                @click="selectHistoryItem(item)"
              >
                <i class="fas fa-history"></i>
                <span>{{ item }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="search-options-bar">
        <a href="#" @click.prevent="switchTab('web')" class="search-option-item" :class="{ 'selected': currentType === 'web' }">Web</a>
        <a href="#" @click.prevent="switchTab('image')" class="search-option-item" :class="{ 'selected': currentType === 'image' }">Images</a>
        <a href="#" @click.prevent="switchTab('video')" class="search-option-item" :class="{ 'selected': currentType === 'video' }">Videos</a>
        <a href="#" @click.prevent="switchTab('news')" class="search-option-item" :class="{ 'selected': currentType === 'news' }">News</a>
        <a href="#" @click.prevent="switchTab('maps')" class="search-option-item" :class="{ 'selected': currentType === 'maps' }">Maps</a>
      </div>

      <div class="error-message" v-if="errorMessage">
        <p>Error: {{ errorMessage }}</p>
      </div>

      <div class="results-wrapper" :class="{ 'full-width-map': currentType === 'maps' }">
        <div class="results-container" :class="{ 'map-layout': currentType === 'maps' }">

          <div v-if="currentType === 'web' && (aiLoading || (aiResponseText && aiResponseText.length > 0))" class="ai-result-card">
            <div class="ai-card-header">
              <div class="ai-icon-wrapper">
                <i class="fas fa-robot"></i>
              </div>
              <span class="ai-title">Synapic AI Overview</span>
            </div>
            
            <div v-if="aiLoading" class="ai-loading-container">
              <div class="skeleton-line width-full"></div>
              <div class="skeleton-line width-90"></div>
              <div class="skeleton-line width-70"></div>
            </div>

            <div v-else class="ai-content-body" :class="{ 'is-collapsed': !isAiExpanded && aiResponseText.length > 350 }">
              <div class="ai-text markdown-body" v-html="renderMarkdown(displayedAiText)"></div>
              <div v-if="aiResponseText.length > 350 && !isAiExpanded" class="read-more-overlay">
                <button @click="isAiExpanded = true" class="read-more-btn">
                  <span>Read More</span>
                  <i class="fas fa-chevron-down"></i>
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="showCalculator && currentType !== 'maps'" class="calculator-widget result-card">
            <h2 class="widget-title"><i class="fas fa-calculator"></i> Calculator</h2>
            <div class="calculator-display">{{ calculatorDisplay }}</div>
            <div class="calculator-grid">
              <button @click="appendChar('(')" class="btn-op">(</button>
              <button @click="appendChar(')')" class="btn-op">)</button>
              <button @click="clearDisplay" class="btn-clear">C</button>
              <button @click="calculateResult" class="btn-equal">=</button>
              
              <button @click="appendChar('7')">7</button>
              <button @click="appendChar('8')">8</button>
              <button @click="appendChar('9')">9</button>
              <button @click="appendChar('/')" class="btn-op">/</button>
              
              <button @click="appendChar('4')">4</button>
              <button @click="appendChar('5')">5</button>
              <button @click="appendChar('6')">6</button>
              <button @click="appendChar('*')" class="btn-op">x</button>
              
              <button @click="appendChar('1')">1</button>
              <button @click="appendChar('2')">2</button>
              <button @click="appendChar('3')">3</button>
              <button @click="appendChar('-')" class="btn-op">-</button>
              
              <button @click="appendChar('0')">0</button>
              <button @click="appendChar('.')">.</button>
              <button @click="backspace" class="btn-op"><i class="fas fa-backspace"></i></button>
              <button @click="appendChar('+')" class="btn-op">+</button>
            </div>
          </div>
          
          <div v-if="showWeatherWidget && weatherData && currentType !== 'maps'" class="weather-widget result-card">
            <h2 class="widget-title">
              <i class="fas fa-cloud-sun"></i> 
              Weather - {{ weatherData.city }}
            </h2>
            <div class="weather-content">
              <div class="weather-main-info">
                <img :src="weatherData.iconUrl" :alt="weatherData.condition" class="weather-icon">
                <div class="temp-display">
                  {{ weatherData.tempC }}°C
                </div>
              </div>
              <div class="weather-details">
                <p class="condition-text">{{ weatherData.condition }}</p>
                <div class="detail-row">
                  <i class="fas fa-thermometer-half"></i> 
                  <span>Feels Like:</span> 
                  <strong>{{ weatherData.feelsLikeC }}°C</strong>
                </div>
                <div class="detail-row">
                  <i class="fas fa-wind"></i> 
                  <span>Wind:</span> 
                  <strong>{{ weatherData.windKph }} km/h</strong>
                </div>
                <div class="detail-row">
                  <i class="fas fa-tint"></i> 
                  <span>Humidity:</span> 
                  <strong>%{{ weatherData.humidity }}</strong>
                </div>
              </div>
            </div>
          </div>

          <template v-if="currentType === 'web' && results.length > 0">
            <div v-for="(result, index) in results" :key="index" class="result-card web-result loaded">
              <a :href="result.link" target="_blank" rel="noopener noreferrer" class="result-url-line">
                <img :src="getFavicon(result.link)" class="favicon" alt="icon" @error="handleFaviconError">
                {{ result.displayUrl }}
              </a>
              <h2 class="result-title">
                <a :href="result.link" target="_blank" rel="noopener noreferrer">{{ result.title }}</a>
              </h2>
              <p class="result-snippet">{{ result.snippet }}</p>
            </div>
          </template>

          <template v-else-if="currentType === 'image' && images.length > 0">
            <h2 class="section-title">Image Results</h2>
            <div class="image-results-container">
              <div class="image-grid">
                <div 
                  v-for="(img, index) in images" 
                  :key="index" 
                  class="image-card"
                  @click="openImageModal(img)"
                >
                  <div class="image-wrapper">
                    <img :src="img.thumbnail || img.link" :alt="img.title">
                  </div>
                  <div class="image-caption">{{ img.title }}</div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="currentType === 'video' && videos.length > 0">
            <h2 class="section-title">Video Results</h2>
            <div class="video-grid">
              <div v-for="(video, index) in videos" :key="index" class="video-card">
                <a :href="video.url" target="_blank" rel="noopener noreferrer" class="video-thumbnail-link">
                  <img :src="video.thumbnail" :alt="video.title">
                </a>
                <div class="video-info">
                  <h3 class="video-title">
                    <a :href="video.url" target="_blank" rel="noopener noreferrer">{{ video.title }}</a>
                  </h3>
                  <span class="video-source">{{ video.source }}</span>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="currentType === 'news' && newsResults.length > 0">
            <h2 class="section-title">News Results</h2>
            <div class="news-list">
              <div v-for="(news, index) in newsResults" :key="index" class="news-card">
                <img v-if="news.image" :src="news.image" :alt="news.title" class="news-thumbnail">
                <div class="news-content">
                  <h3 class="news-title">
                    <a :href="news.link" target="_blank" rel="noopener noreferrer">{{ news.title }}</a>
                  </h3>
                  <p class="news-snippet">{{ news.snippet }}</p>
                  <div class="news-meta">
                    <span>{{ news.source }}</span>
                    <span v-if="news.displayUrl"> ({{ news.displayUrl }})</span>
                    <span v-if="news.date" class="news-date">| {{ formatDate(news.date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="currentType === 'maps'">
            <div class="map-visual-container" style="width: 100%; height: 100%;">
                <iframe 
                    :src="currentMapUrl" 
                    width="100%" 
                    height="100%" 
                    style="border:0;" 
                    allowfullscreen="" 
                    loading="lazy" 
                    referrerpolicy="no-referrer-when-downgrade">
                </iframe>
            </div>
          </template>

          <template v-else-if="currentType === 'wiki'">
            <div v-if="wiki && wiki.title" class="wiki-card">
              <img v-if="wiki.image" :src="wiki.image" :alt="wiki.title" class="wiki-image">
              <h2 class="wiki-title">
                <a :href="wiki.link" target="_blank" rel="noopener noreferrer">{{ wiki.title }}</a>
              </h2>
              <p class="wiki-summary">{{ wiki.summary }}</p>
              <a :href="wiki.link" target="_blank" rel="noopener noreferrer" class="wiki-source">Source: Wikipedia</a>
            </div>
            <div v-else class="no-results">
              <p class="no-results-title">No Wikipedia result found for "{{ searchQuery }}".</p>
            </div>
          </template>

        </div>
      </div>
    </main>

    <div class="overlay" :class="{ 'is-active': activeOverlay === 'imageModal' }" @click.self="closeOverlay">
      <button class="overlay-close" @click="closeOverlay">
        <i class="fas fa-times"></i>
      </button>
      <div class="image-modal-content">
        <img v-if="selectedImage" :src="selectedImage.link" alt="Enlarged" class="modal-image">
        <h3 v-if="selectedImage" class="modal-image-title">{{ selectedImage.title }}</h3>
        <a v-if="selectedImage" :href="selectedImage.link" target="_blank" rel="noopener noreferrer" class="modal-action-btn">Go to Image</a>
      </div>
    </div>

    <div class="overlay slide-overlay" :class="{ 'is-active': activeOverlay === 'controlCenter' }" @click.self="closeOverlay">
      <button class="overlay-close" @click="closeOverlay">
        <i class="fas fa-xmark"></i>
      </button>
      <div class="overlay-panel">
        <h2 class="overlay-title">Control Center</h2>
        <div class="menu-container">
          <a href="#" @click.prevent="openOverlay('searchOptions')" class="menu-item">
            <i class="fas fa-gear"></i>
            <span>Search Options</span>
          </a>
          <a href="/terms" class="menu-item">
            <i class="fa-solid fa-lock"></i>
            <span>Privacy & Terms</span>
            </a>
        </div>
      </div>
    </div>

    <div class="overlay slide-overlay" :class="{ 'is-active': activeOverlay === 'searchOptions' }" @click.self="closeOverlay">
      <button class="overlay-close" @click="closeOverlay">
        <i class="fas fa-times"></i>
      </button>
      <div class="overlay-panel">
        <h2 class="overlay-title">Search Options</h2>
        <div class="options-content">
          <div class="menu-item option-row">
            <label for="locationBased">Location-Based Results</label>
            <label class="toggle-switch">
              <input type="checkbox" id="locationBased" v-model="settings.locationBased">
              <span class="slider"></span>
            </label>
          </div>
          <div class="menu-item option-row">
            <label for="languageSelect">Language:</label>
            <select id="languageSelect" v-model="settings.language" class="custom-select">
              <option value="tr">Turkish</option>
<option value="de">Deutsch</option>
<option value="us">English (US)</option>
<option value="fr">Français</option>
<option value="ru">Русский</option>
<option value="jp">日本語</option>
<option value="es">Español</option>
<option value="it">Italiano</option>
<option value="cn">简体中文</option>
<option value="gb">English (UK)</option>
<option value="br">Português (BR)</option>
<option value="ar">العربية</option>
<option value="nl">Nederlands</option>
<option value="pl">Polski</option>
<option value="kr">한국어</option>
<option value="in">English (IN)</option>
<option value="ca">English (CA)</option>
<option value="au">English (AU)</option>
<option value="sa">العربية (SA)</option>
<option value="se">Svenska</option>
<option value="no">Norsk</option>
<option value="dk">Dansk</option>
<option value="fi">Suomi</option>
<option value="gr">Ελληνικά</option>
<option value="il">עברית</option>
<option value="mx">Español (MX)</option>
<option value="id">Bahasa Indonesia</option>
<option value="th">ไทย</option>
<option value="vn">Tiếng Việt</option>
<option value="za">English (ZA)</option>
            </select>
          </div>
          <button class="save-settings-btn" @click="saveSettings">Save Settings</button>
        </div>
      </div>
    </div>

    <div class="overlay grid-view-overlay" :class="{ 'is-active': activeOverlay === 'gridView' }" @click.self="closeOverlay">
      <button class="overlay-close" aria-label="Close" @click="closeOverlay">
        <i class="fas fa-xmark"></i>
      </button>
      <div class="modal-content">
        <h2 class="modal-title">Quick Search</h2>
        <form aria-label="Quick search form" class="quick-search-form" @submit.prevent="handleQuickSearch">
          <div class="quick-search-wrapper">
            <input 
              class="quick-search-input"
              name="query" 
              type="search"
              v-model="quickSearchQuery"
              :placeholder="quickSearchPlaceholder"
              ref="quickSearchInputRef"
            />
            <button aria-label="Quick Search Submit" class="quick-search-btn" type="submit">
              <i class="fas fa-magnifying-glass"></i>
            </button>
          </div>
        </form>

        <nav class="quick-links">
          <a href="#" @click.prevent="setQuickSearchType('web')" class="quick-link">
            <i class="fas fa-globe active-icon"></i>
            <span class="link-text">Search Web</span>
          </a>
          <a href="#" @click.prevent="setQuickSearchType('image')" class="quick-link">
            <i class="fas fa-image active-icon"></i>
            <span class="link-text">Search Images</span>
          </a>
          <a href="#" @click.prevent="setQuickSearchType('news')" class="quick-link">
            <i class="fas fa-newspaper active-icon"></i>
            <span class="link-text">Search News</span>
          </a>
          <a href="#" @click.prevent="setQuickSearchType('maps')" class="quick-link">
            <i class="fa-sharp fa-solid fa-map-location active-icon"></i>
            <span class="link-text">Search Maps</span>
          </a>
          <a href="#" @click.prevent="setQuickSearchType('video')" class="quick-link">
            <i class="fas fa-video active-icon"></i>
            <span class="link-text">Search Videos</span>
          </a>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'; 
import markdownit from 'markdown-it';

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true
});

const renderMarkdown = (text) => {
  return md.render(text || '');
};

const searchQuery = ref('');
const quickSearchQuery = ref('');
const quickSearchType = ref('web');
const quickSearchPlaceholder = ref('Search the web...');
const quickSearchInputRef = ref(null);
const currentType = ref('web');
const activeOverlay = ref(null);
const showHistory = ref(false);
const searchHistory = ref([]);
const errorMessage = ref('');
const selectedImage = ref(null);
const hasSearched = ref(false);
const isAiExpanded = ref(false);

const settings = ref({
  locationBased: false,
  language: 'tr'
});

const results = ref([]);
const images = ref([]);
const videos = ref([]);
const newsResults = ref([]);
const places = ref([]);
const activePlace = ref(null);
const currentMapUrl = ref('');
const wiki = ref({});

const aiResponseText = ref('');
const aiLoading = ref(false);

const API_BASE_URL = '/api/search'; 

const showCalculator = ref(false);
const calculatorDisplay = ref('0');
let currentCalculation = '';

const showWeatherWidget = ref(false);
const weatherData = ref(null);

const displayedAiText = computed(() => {
  if (isAiExpanded.value || aiResponseText.value.length <= 350) {
    return aiResponseText.value;
  }
  return aiResponseText.value.substring(0, 350);
});

const getFavicon = (url) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`;
  } catch (e) {
    return ''; 
  }
};

const handleFaviconError = (e) => {
  e.target.style.display = 'none';
};

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return dateString;
  }
};

const appendChar = (char) => {
  if (calculatorDisplay.value === 'Error' || calculatorDisplay.value === 'NaN') {
    calculatorDisplay.value = '0';
    currentCalculation = '';
  }
  
  if (calculatorDisplay.value === '0' && (char >= '0' && char <= '9')) {
    calculatorDisplay.value = char;
  } else {
    calculatorDisplay.value += char;
  }
  currentCalculation += char;
};

const clearDisplay = () => {
  calculatorDisplay.value = '0';
  currentCalculation = '';
};

const backspace = () => {
  if (calculatorDisplay.value.length > 1) {
    calculatorDisplay.value = calculatorDisplay.value.slice(0, -1);
    currentCalculation = currentCalculation.slice(0, -1);
  } else {
    clearDisplay();
  }
};

const calculateResult = () => {
  try {
    let expression = currentCalculation.replace(/x/g, '*');
    const result = new Function('return ' + expression)();
    calculatorDisplay.value = result.toString();
    currentCalculation = result.toString();
  } catch (error) {
    calculatorDisplay.value = 'Error';
    currentCalculation = '';
  }
};

const fetchWeather = async (locationQuery) => {
  weatherData.value = null;
  const mockWeatherData = {
    istanbul: { city: 'İstanbul', tempC: 18, condition: 'Parçalı Bulutlu', iconUrl: 'https://cdn.weatherapi.com/v1/current/64x64/day/116.png', feelsLikeC: 17, windKph: 12, humidity: 75 },
    ankara: { city: 'Ankara', tempC: 12, condition: 'Güneşli', iconUrl: 'https://cdn.weatherapi.com/v1/current/64x64/day/113.png', feelsLikeC: 10, windKph: 8, humidity: 60 },
    default: { city: locationQuery, tempC: 22, condition: 'Bilinmeyen Konum', iconUrl: 'https://cdn.weatherapi.com/v1/current/64x64/day/122.png', feelsLikeC: 21, windKph: 15, humidity: 65 }
  };
  if (locationQuery.toLowerCase().includes('istanbul')) weatherData.value = mockWeatherData.istanbul;
  else if (locationQuery.toLowerCase().includes('ankara')) weatherData.value = mockWeatherData.ankara;
  else weatherData.value = { ...mockWeatherData.default, city: locationQuery.charAt(0).toUpperCase() + locationQuery.slice(1) };
};

const checkForSpecialQuery = (query) => {
  const normalizedQuery = query.toLowerCase().trim();
  const calculatorKeywords = ['calculator', 'hesap makinesi', 'rechner', 'calculate', 'hesapla'];
  const weatherKeywords = ['weather', 'hava durumu', 'wetter', 'forecast', 'tahmin', 'sıcaklık'];
  showCalculator.value = calculatorKeywords.some(keyword => normalizedQuery.includes(keyword));
  const shouldShowWeather = weatherKeywords.some(keyword => normalizedQuery.includes(keyword));
  showWeatherWidget.value = shouldShowWeather;
  if (shouldShowWeather) {
    const locationQuery = normalizedQuery.replace(new RegExp(weatherKeywords.join('|'), 'gi'), '').trim() || 'istanbul';
    fetchWeather(locationQuery);
  }
  return showCalculator.value || showWeatherWidget.value; 
};

const fetchAiResponse = async (query) => {
  aiLoading.value = true;
  aiResponseText.value = ''; 
  isAiExpanded.value = false;
  try {
    const response = await fetch(`${API_BASE_URL}?q=${encodeURIComponent(query)}&type=ai`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.response) {
        aiResponseText.value = data.response;
      }
    }
  } catch (error) {
    console.error('AI fetch error', error);
  } finally {
    aiLoading.value = false;
  }
};

const selectPlace = (place) => {
    activePlace.value = place;
    if (place.lat && place.lon) {
         currentMapUrl.value = `https://maps.google.com/maps?q=${place.lat},${place.lon}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    } else {
         const encodedQuery = encodeURIComponent(`${place.title}, ${place.address}`);
         currentMapUrl.value = `https://maps.google.com/maps?q=${encodedQuery}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
    }
};

const fetchResults = async (query, type) => {
  errorMessage.value = '';
  hasSearched.value = true;
  results.value = [];
  images.value = [];
  videos.value = [];
  newsResults.value = [];
  places.value = [];
  activePlace.value = null;
  wiki.value = {};

  if (query.trim() === '') return;
  const url = `${API_BASE_URL}?q=${encodeURIComponent(query)}&type=${type}&kl=${settings.value.language}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { errorData = { message: 'API error' }; }
        errorMessage.value = errorData.message || 'Error';
        return;
    }
    const data = await response.json();

    if (type === 'wiki') {
      wiki.value = data.wiki || {};
    } else if (type === 'image') {
      images.value = data.images || [];
    } else if (type === 'video') {
      videos.value = data.videos || [];
    } else if (type === 'news') {
      newsResults.value = data.newsResults || [];
    } else if (type === 'maps') {
      places.value = data.mapsResults || [];
      if (places.value.length > 0) {
        selectPlace(places.value[0]);
      } else {
        currentMapUrl.value = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
      }
    } else if (type === 'web') {
      const payload = data.results || [];
      if (Array.isArray(payload)) {
        let index = 0;
        const addResult = () => {
          if (index < payload.length) {
            results.value.push(payload[index]);
            index++;
            setTimeout(addResult, 50);
          }
        };
        addResult();
      }
    }
  } catch (error) {
    errorMessage.value = 'Connection error';
  }
};

const handleSearch = () => {
  const query = searchQuery.value.trim();
  if (query !== '') {
    saveSearchQuery(query);
    checkForSpecialQuery(query);
    fetchAiResponse(query);
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('query', query);
    urlParams.set('type', currentType.value); 
    urlParams.set('kl', settings.value.language);
    history.pushState(null, '', `?${urlParams.toString()}`);
    fetchResults(query, currentType.value); 
    hasSearched.value = true;
  }
};

const setQuickSearchType = (type) => {
  quickSearchType.value = type;
  switch (type) {
    case 'web': quickSearchPlaceholder.value = "Search the web..."; break;
    case 'image': quickSearchPlaceholder.value = "Search images..."; break;
    case 'news': quickSearchPlaceholder.value = "Search news..."; break;
    case 'video': quickSearchPlaceholder.value = "Search videos..."; break;
    default: quickSearchPlaceholder.value = "Search...";
  }
  nextTick(() => {
    quickSearchInputRef.value?.focus();
  });
};

const handleQuickSearch = () => {
  if (quickSearchQuery.value.trim() !== '') {
    searchQuery.value = quickSearchQuery.value;
    currentType.value = quickSearchType.value;
    closeOverlay();
    handleSearch();
  }
};

const switchTab = (type) => {
  currentType.value = type;
  if (searchQuery.value.trim() !== '') handleSearch();
  else {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('type', type); 
    history.replaceState(null, '', `?${urlParams.toString()}`);
  }
};

const saveSearchQuery = (query) => {
  if (query && !searchHistory.value.includes(query)) {
    searchHistory.value.unshift(query);
    searchHistory.value = searchHistory.value.slice(0, 5);
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
  }
};

const selectHistoryItem = (item) => {
  searchQuery.value = item;
  showHistory.value = false;
  handleSearch();
};

const clearSearch = () => { searchQuery.value = ''; };

const handleBlur = () => { setTimeout(() => { showHistory.value = false; }, 200); };

const openOverlay = (name) => {
  activeOverlay.value = name;
  if (name === 'controlCenter' || name === 'searchOptions') document.body.classList.add('right-panel-active');
  if (name === 'gridView') {
    quickSearchQuery.value = searchQuery.value;
    nextTick(() => {
      quickSearchInputRef.value?.focus();
    });
  }
};

const closeOverlay = () => {
  activeOverlay.value = null;
  document.body.classList.remove('right-panel-active');
};

const openImageModal = (img) => {
  selectedImage.value = img;
  openOverlay('imageModal');
};

const saveSettings = () => {
  localStorage.setItem('synapicSearchLang', settings.value.language);
  localStorage.setItem('synapicLocationBased', settings.value.locationBased);
  closeOverlay();
};

onMounted(() => {
  const history = localStorage.getItem('searchHistory');
  if (history) searchHistory.value = JSON.parse(history);
  const lang = localStorage.getItem('synapicSearchLang');
  if (lang) settings.value.language = lang;
  const loc = localStorage.getItem('synapicLocationBased');
  if (loc) settings.value.locationBased = loc === 'true';
  const urlParams = new URLSearchParams(window.location.search);
  const urlQuery = urlParams.get('query');
  const urlType = urlParams.get('type');
  const urlLang = urlParams.get('kl');
  if (urlLang) settings.value.language = urlLang;
  if (urlQuery) {
    searchQuery.value = urlQuery;
    currentType.value = urlType || 'web'; 
    checkForSpecialQuery(urlQuery);
    fetchAiResponse(urlQuery);
    fetchResults(searchQuery.value, currentType.value);
    hasSearched.value = true;
  }
});
</script>


<style scoped>
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css');
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
  
  .app-container {
    font-family: 'Inter', sans-serif;
    background-color: #000000;
    color: white;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }
  
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  
  .main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
  }
  
  .brand-logo {
    color: white;
    font-weight: 800;
    font-size: 1.875rem;
    letter-spacing: -0.025em;
    text-decoration: none;
  }
  
  .header-actions {
    display: flex;
    gap: 1.5rem;
  }
  
  .icon-button {
    color: white;
    font-size: 1.25rem;
    background: none;
    border: none;
    cursor: pointer;
  }
  
  .main-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
  }
  
  .search-bar-container {
    position: relative;
    width: 100%;
    max-width: 700px;
    margin-bottom: 2rem;
  }
  
  .search-input-wrapper {
    display: flex;
    align-items: center;
    background-color: #2C2C2E;
    border-radius: 9999px;
    padding: 0.5rem 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border: 1px solid #3A3A3C;
  }
  
  .search-input {
    flex-grow: 1;
    background-color: transparent;
    border: none;
    outline: none;
    font-size: 1.125rem;
    color: #E0E0E0;
    padding: 0.5rem 0;
  }
  
  .search-input::placeholder {
    color: #8E8E93;
  }
  
  .clear-search-button {
    background: none;
    border: none;
    color: #8E8E93;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 0.5rem;
  }
  
  .search-separator {
    width: 1px;
    background-color: #3A3A3C;
    height: 1.5rem;
    margin: 0 0.75rem;
  }
  
  .search-submit-button {
    background: none;
    border: none;
    color: #007AFF;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 0.5rem;
  }
  
  .search-history-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background-color: #2C2C2E;
    border-radius: 1rem;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
    z-index: 50;
    padding: 1rem;
    border: 1px solid #3A3A3C;
  }
  
  .history-title {
    font-size: 0.875rem;
    font-weight: bold;
    color: #8E8E93;
    margin-bottom: 0.5rem;
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .history-item {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    color: #E0E0E0;
    cursor: pointer;
  }
  
  .history-item:hover {
    background-color: #3A3A3C;
  }
  
  .history-item i {
    margin-right: 0.5rem;
    color: #8E8E93;
  }
  
  .search-options-bar {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1rem;
    width: 100%;
    max-width: 700px;
  }
  
  .search-option-item {
    color: #8E8E93;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 0.5rem 0.2rem;
    text-decoration: none;
  }
  
  .search-option-item.selected {
    color: #007AFF;
    font-weight: bold;
  }
  
  .error-message {
    background-color: #991b1b;
    color: white;
    padding: 1rem;
    border-radius: 0.5rem;
    width: 100%;
    max-width: 700px;
    margin: 1rem auto;
  }
  
  .results-wrapper {
    display: flex;
    width: 100%;
    max-width: 1100px;
    justify-content: center;
    margin-top: 2rem;
  }
  
  .results-wrapper.full-width-map {
      max-width: 100%;
      padding: 0 1rem;
  }
  
  .results-container {
    flex-grow: 1;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .results-container.map-layout {
      max-width: 100%;
      flex-direction: row;
      height: 65vh;
  }
  
  .section-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1rem;
    text-align: center;
  }
  
  .result-card {
    background-color: #2C2C2E;
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
  
  .result-url-line {
    color: #8E8E93;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    margin-bottom: 0.25rem;
    text-decoration: none;
  }
  
  .favicon {
    width: 1rem;
    height: 1rem;
    margin-right: 0.25rem;
  }
  
  .result-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
    margin-bottom: 0.5rem;
  }
  
  .result-title a {
    color: inherit;
    text-decoration: none;
  }
  
  .result-snippet {
    color: #E0E0E0;
    font-size: 0.875rem;
    line-height: 1.625;
  }
  
  .image-results-container {
    width: 100%;
    background-color: #2C2C2E;
    padding: 1rem;
    border-radius: 0.5rem;
  }
  
  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.5rem;
    justify-items: center;
  }
  
  .image-card {
    background-color: #1a1a1a;
    padding: 0.25rem;
    border-radius: 0.5rem;
    cursor: pointer;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
  
  .image-wrapper {
    height: 100%;
    width: 100%;
    overflow: hidden;
    border-radius: 0.375rem;
  }
  
  .image-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .image-caption {
    font-size: 0.75rem;
    color: #E0E0E0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    padding-top: 0.25rem;
  }
  
  .video-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  @media (min-width: 640px) {
    .video-grid { grid-template-columns: repeat(2, 1fr); }
  }
  
  .video-card {
    background-color: #2C2C2E;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .video-thumbnail-link img {
    width: 100%;
    height: 10rem;
    object-fit: cover;
  }
  
  .video-info { padding: 0.75rem; }
  
  .video-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.25rem;
  }
  
  .video-title a {
    color: inherit;
    text-decoration: none;
  }
  
  .video-source {
    color: #8E8E93;
    font-size: 0.875rem;
  }
  
  .news-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .news-card {
    background-color: #2C2C2E;
    padding: 1rem;
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  @media (min-width: 640px) {
    .news-card { flex-direction: row; gap: 1rem; }
  }
  
  .news-thumbnail {
    width: 100%;
    height: 6rem;
    object-fit: cover;
    border-radius: 0.375rem;
  }
  
  @media (min-width: 640px) {
    .news-thumbnail { width: 8rem; }
  }
  
  .news-content { flex-grow: 1; }
  
  .news-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.25rem;
  }
  
  .news-title a {
    color: inherit;
    text-decoration: none;
  }
  
  .news-snippet {
    color: #E0E0E0;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }
  
  .news-meta {
    color: #8E8E93;
    font-size: 0.75rem;
  }
  
  .wiki-card {
    background-color: #2C2C2E;
    padding: 1.5rem;
    border-radius: 0.5rem;
    width: 100%;
  }
  
  .wiki-image {
    width: 100%;
    height: 12rem;
    object-fit: cover;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }
  
  .wiki-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 0.5rem;
  }
  
  .wiki-title a {
    color: inherit;
    text-decoration: none;
  }
  
  .wiki-summary {
    color: #E0E0E0;
    font-size: 0.875rem;
    line-height: 1.625;
    margin-bottom: 1rem;
  }
  
  .wiki-source {
    color: #8E8E93;
    font-size: 0.75rem;
    text-decoration: none;
  }
  
  .maps-split-view {
      display: flex;
      width: 100%;
      height: 100%;
      gap: 1rem;
      overflow: hidden;
  }
  
  .places-sidebar {
      width: 300px;
      background-color: #1a1a1a;
      border-radius: 0.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1px;
  }
  
  .place-item {
      display: flex;
      padding: 1rem;
      background-color: #2C2C2E;
      cursor: pointer;
      transition: background-color 0.2s;
      border-bottom: 1px solid #3a3a3a;
  }
  
  .place-item:hover {
      background-color: #3A3A3C;
  }
  
  .place-item.active {
      background-color: #004a99;
      border-left: 4px solid #007aff;
  }
  
  .place-icon {
      margin-right: 0.75rem;
      color: #007aff;
      font-size: 1.25rem;
      margin-top: 0.2rem;
  }
  
  .place-item.active .place-icon {
      color: white;
  }
  
  .place-info {
      flex-grow: 1;
  }
  
  .place-name {
      font-weight: 600;
      color: white;
      margin-bottom: 0.25rem;
  }
  
  .place-address {
      font-size: 0.8rem;
      color: #aaa;
      line-height: 1.3;
  }
  
  .map-visual-container {
      flex-grow: 1;
      background-color: #1a1a1a;
      border-radius: 0.5rem;
      overflow: hidden;
  }
  
  .no-results {
    text-align: center;
    color: #8E8E93;
    padding: 2rem 0;
  }
  
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: flex;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s;
  }
  
  .overlay.is-active {
    opacity: 1;
    visibility: visible;
  }
  
  .overlay-close {
    position: absolute;
    top: 1rem;
    right: 1.5rem;
    color: #999;
    cursor: pointer;
    background: none;
    border: none;
    font-size: 2rem;
    z-index: 1001;
    transition: color 0.2s ease-in-out;
  }
  
  .overlay-close:hover {
    color: #007aff;
  }
  
  .image-modal-content {
    background-color: #1a1a1a;
    padding: 1.5rem;
    border-radius: 0.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 90%;
    margin: auto;
  }
  
  .modal-image {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .modal-image-title {
    color: white;
    margin-bottom: 0.5rem;
  }
  
  .modal-action-btn {
    padding: 0.5rem 1rem;
    background-color: #007aff;
    color: white;
    border-radius: 9999px;
    text-decoration: none;
  }
  
  .slide-overlay .overlay-panel {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 320px;
    background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.7);
    transform: translateX(100%);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 1.5rem;
    overflow-y: auto;
    border-left: 1px solid #333;
  }
  
  .slide-overlay.is-active .overlay-panel { 
    transform: translateX(0); 
  }
  
  .overlay-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: white;
  }
  
  .menu-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .menu-item {
    display: flex;
    align-items: center;
    padding: 0.8rem 1.2rem;
    background-color: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 0.75rem;
    color: #e0e0e0;
    text-decoration: none;
    margin-bottom: 0;
    transition: background-color 0.2s;
  }
  
  .menu-item:hover {
    background-color: #3a3a3a;
  }
  
  .menu-item i {
    margin-right: 1rem;
    font-size: 1.5rem;
    color: #007aff;
    width: 1.5rem;
    text-align: center;
  }
  
  .menu-item span {
    font-size: 0.95rem;
    font-weight: 500;
  }
  
  .options-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0.75rem;
    background-color: #2a2a2a;
    border-radius: 0.75rem;
  }
  
  .option-row label {
    color: white;
    font-size: 1rem;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 28px;
  }
  
  .toggle-switch input { 
    opacity: 0; 
    width: 0; 
    height: 0; 
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0; 
    left: 0; 
    right: 0; 
    bottom: 0;
    background-color: #3a3a3a;
    transition: .4s;
    border-radius: 28px;
    border: 1px solid #4a4a4a;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 20px; 
    width: 20px;
    left: 3px; 
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  input:checked + .slider { 
    background-color: #007aff;
    border-color: #007aff;
  }
  
  input:checked + .slider:before { 
    transform: translateX(20px); 
  }
  
  .custom-select {
    background-color: #1a1a1a;
    color: white;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #3a3a3a;
    font-size: 1rem;
  }
  
  .save-settings-btn {
    margin-top: 1.5rem;
    padding: 0.75rem 1.5rem;
    background-color: #007aff;
    color: white;
    border-radius: 9999px;
    border: none;
    font-weight: 700;
    width: 100%;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .save-settings-btn:hover {
    background-color: #005bb5;
  }
  
  .grid-view-overlay {
    justify-content: center;
    align-items: center;
  }
  
  .modal-content {
    background-color: #1a1a1a;
    padding: 2.5rem;
    border-radius: 1rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    width: 90%;
    max-width: 450px;
    position: relative;
    transform: translateY(-30px);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out;
    opacity: 0;
    border: 1px solid #333;
  }
  
  .grid-view-overlay.is-active .modal-content {
    transform: translateY(0);
    opacity: 1;
  }
  
  .modal-title {
    font-size: 1.875rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: white;
    text-align: center;
  }
  
  .quick-search-form {
    width: 100%;
    margin-bottom: 1.5rem;
  }
  
  .quick-search-wrapper {
    position: relative;
    margin-bottom: 1rem;
  }
  
  .quick-search-input {
    width: 100%;
    border-radius: 9999px;
    background-color: #18181B;
    color: #e0e0e0;
    padding: 0.75rem 3rem 0.75rem 1.5rem;
    font-size: 1rem;
    border: 1px solid transparent;
    outline: none;
    box-sizing: border-box;
  }
  
  .quick-search-input:focus {
    box-shadow: 0 0 0 1px #007aff;
    background-color: #2a2a2a;
  }
  
  .quick-search-input::placeholder {
    color: #8e8e93;
  }
  
  .quick-search-btn {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #999;
    background: none;
    border: none;
    cursor: pointer;
  }
  
  .quick-search-btn:hover {
    color: white;
  }
  
  .quick-links {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 1.125rem;
  }
  
  .quick-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    text-decoration: none;
    transition: background-color 0.2s;
  }
  
  .quick-link:hover {
    background-color: #2a2a2a;
  }
  
  .active-icon {
    color: #007aff;
    width: 1.5rem;
    text-align: center;
  }
  
  .link-text {
    color: white;
  }
  
  body.right-panel-active .main-content,
  body.right-panel-active .main-header {
    transform: translateX(-320px);
  }
  
  .weather-widget {
    max-width: 400px;
    background-color: #1a1a1a;
    border: 1px solid #3a3a3a;
    padding: 1.5rem;
    margin: 1.5rem auto;
  }
  
  .weather-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .weather-main-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .weather-icon {
    width: 64px;
    height: 64px;
  }
  
  .temp-display {
    font-size: 3rem;
    font-weight: bold;
  }
  
  .weather-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .condition-text {
    font-size: 1.125rem;
    color: #E0E0E0;
    margin-bottom: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .detail-row i {
    color: #007AFF;
    width: 1.25rem;
  }
  
  .widget-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }
  
  .widget-title i {
    color: #007AFF;
  }
  
  .calculator-widget {
    max-width: 320px;
    background-color: #1a1a1a;
    border: 1px solid #3a3a3a;
    padding: 1.5rem;
    margin: 1.5rem auto;
  }
  
  .calculator-display {
    background-color: #0d0d0d;
    color: white;
    font-size: 2.5rem;
    text-align: right;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    word-wrap: break-word;
  }
  
  .calculator-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }
  
  .calculator-grid button {
    background-color: #2c2c2e;
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 9999px;
    cursor: pointer;
    height: 50px;
    font-size: 1.125rem;
    transition: background-color 0.2s;
  }
  
  .calculator-grid button:hover {
    background-color: #3a3a3c;
  }
  
  .calculator-grid .btn-op {
    background-color: #3a3a3c;
  }
  
  .calculator-grid .btn-clear {
    background-color: #dc3545;
  }
  
  .calculator-grid .btn-equal {
    background-color: #007aff;
  }
  
  .ai-result-card {
    background: linear-gradient(145deg, #1e1e24 0%, #17171a 100%);
    border: 1px solid #3a3a3c;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border-left: 4px solid #8e44ad;
  }
  
  .ai-card-header {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #333;
  }
  
  .ai-icon-wrapper {
    background: linear-gradient(135deg, #8e44ad, #3498db);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.75rem;
  }
  
  .ai-icon-wrapper i { 
    color: white; 
    font-size: 0.9rem; 
  }
  
  .ai-title {
    font-size: 1.1rem;
    font-weight: 700;
    background: linear-gradient(90deg, #fff, #b0b0b0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .ai-content-body {
    color: #e0e0e0;
    line-height: 1.6;
    font-size: 0.95rem;
    position: relative;
  }
  
  .ai-content-body.is-collapsed {
    max-height: 200px;
    overflow: hidden;
  }
  
  .ai-text { 
    white-space: pre-wrap; 
  }
  
  .read-more-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100px;
    background: linear-gradient(transparent, #17171a);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 0.5rem;
  }
  
  .read-more-btn {
    background-color: #2c2c2e;
    border: 1px solid #444;
    color: #eee;
    padding: 8px 24px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  
  .read-more-btn:hover {
    background-color: #3a3a3c;
    border-color: #8e44ad;
    transform: translateY(-2px);
  }
  
  .read-more-btn i {
    font-size: 0.7rem;
    transition: transform 0.2s;
  }
  
  .read-more-btn:hover i { 
    transform: translateY(2px); 
  }
  
  .ai-loading-container { 
    display: flex; 
    flex-direction: column; 
    gap: 0.5rem; 
  }
  
  .skeleton-line {
    height: 12px;
    background-color: #333;
    border-radius: 6px;
    animation: pulse 1.5s infinite;
  }
  
  .width-full { width: 100%; }
  .width-90 { width: 90%; }
  .width-70 { width: 70%; }
  
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.3; }
    100% { opacity: 0.6; }
  }
  
  .markdown-body :deep(h1), 
  .markdown-body :deep(h2), 
  .markdown-body :deep(h3) { 
    margin-top: 1rem; 
    margin-bottom: 0.5rem; 
    color: #fff; 
  }
  
  .markdown-body :deep(p) { 
    margin-bottom: 0.75rem; 
  }
  
  .markdown-body :deep(code) { 
    background-color: #3a3a3c; 
    padding: 0.2rem 0.4rem; 
    border-radius: 4px; 
    font-family: monospace; 
  }
  
  .markdown-body :deep(pre) { 
    background-color: #1a1a1a; 
    padding: 1rem; 
    border-radius: 8px; 
    overflow-x: auto; 
    margin: 1rem 0; 
  }
  </style>
