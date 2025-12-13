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
        <a href="#" @click.prevent="switchTab('wiki')" class="search-option-item" :class="{ 'selected': currentType === 'wiki' }">Wikipedia</a>
      </div>

      <div class="error-message" v-if="errorMessage">
        <p>Error: {{ errorMessage }}</p>
      </div>

      <div class="results-wrapper">
        <div class="results-container">
          
          <div v-if="isFetching && currentType === 'web'" class="loading-indicator">
            <p>Aranıyor ve sonuçlar yükleniyor...</p>
          </div>

          <template v-else-if="currentType === 'web' && results.length > 0">
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

          <template v-else-if="!errorMessage && searchQuery && hasSearched && (results.length === 0 && images.length === 0 && videos.length === 0 && newsResults.length === 0 && !wiki.title)">
            <div class="no-results">
              
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
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
          <button class="save-settings-btn" @click="saveSettings">Save Settings</button>
        </div>
      </div>
    </div>

    <div class="overlay grid-view-overlay" :class="{ 'is-active': activeOverlay === 'gridView' }" @click.self="closeOverlay">
      <button class="overlay-close" @click="closeOverlay">
        <i class="fas fa-times"></i>
      </button>
      <div class="grid-modal-content">
        <h2 class="grid-title">Quick Search</h2>
        <form class="quick-search-form" @submit.prevent="handleQuickSearch">
          <div class="quick-input-wrapper">
            <input 
              class="quick-search-input" 
              placeholder="Search..." 
              type="search" 
              v-model="quickSearchQuery"
            />
            <button class="quick-submit-btn" type="submit">
              <i class="fas fa-magnifying-glass"></i>
            </button>
          </div>
        </form>
        <nav class="quick-nav">
          <a href="#" @click.prevent="quickNavigate('web')" class="quick-link">
            <i class="fas fa-globe"></i>
            <span>Search Web</span>
          </a>
          <a href="#" @click.prevent="quickNavigate('image')" class="quick-link">
            <i class="fas fa-image"></i>
            <span>Search Images</span>
          </a>
          <a href="#" @click.prevent="quickNavigate('news')" class="quick-link">
            <i class="fas fa-newspaper"></i>
            <span>Search News</span>
          </a>
          <a href="#" @click.prevent="quickNavigate('wiki')" class="quick-link">
            <i class="fas fa-wikipedia-w"></i>
            <span>Search Wikipedia</span>
          </a>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'; 

const searchQuery = ref('');
const quickSearchQuery = ref('');
const currentType = ref('web');
const activeOverlay = ref(null);
const showHistory = ref(false);
const searchHistory = ref([]);
const errorMessage = ref('');
const selectedImage = ref(null);
const hasSearched = ref(false);
const isFetching = ref(false); // Yeni yüklenme durumu

const settings = ref({
  locationBased: false,
  language: 'tr'
});

const results = ref([]);
const images = ref([]);
const videos = ref([]);
const newsResults = ref([]);
const wiki = ref({});

const API_BASE_URL = '/api/search'; 
const API_KEY = 'synapic'; 

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

const fetchResults = async (query, type) => {
  errorMessage.value = '';
  hasSearched.value = true;
  
  // Önceki sonuçları temizle
  results.value = [];
  images.value = [];
  videos.value = [];
  newsResults.value = [];
  wiki.value = {};

  if (query.trim() === '') return;

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}&type=${type}&lang=${settings.value.language}&apikey=${API_KEY}`;

  isFetching.value = true; // Yüklenmeye başla

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: 'API sunucusu HTTP hatası verdi.' };
        }
        errorMessage.value = errorData.message || `API'den bir hata döndü. (Durum: ${response.status} ${response.statusText})`;
        isFetching.value = false; // Hata durumunda yüklemeyi bitir
        return;
    }

    const data = await response.json();

    if (type === 'wiki') {
      if (data.wiki && typeof data.wiki === 'object' && data.wiki !== null && data.wiki.title) {
        wiki.value = data.wiki;
      } else {
        wiki.value = {}; 
      }
      isFetching.value = false;
    } else if (type === 'image') {
      if (data.images && Array.isArray(data.images)) {
        images.value = data.images;
      } else {
        errorMessage.value = `API'den beklenen image dizisi gelmedi.`;
      }
      isFetching.value = false;
    } else if (type === 'video') { 
      if (data.videos && Array.isArray(data.videos)) {
        videos.value = data.videos;
      } else {
        errorMessage.value = `API'den beklenen video dizisi gelmedi.`;
      }
      isFetching.value = false;
    } else if (type === 'news') {
      if (data.newsResults && Array.isArray(data.newsResults)) {
        newsResults.value = data.newsResults;
      } else {
        errorMessage.value = `API'den beklenen haber dizisi gelmedi.`;
      }
      isFetching.value = false;
    } else { // 'web' için - Aşamalı yükleme burada uygulanıyor
      const allResults = data.results || []; 

      if (Array.isArray(allResults) && allResults.length > 0) {
        // *** Aşamalı Yükleme Mantığı (Incremental Loading) ***
        let index = 0;
        const addResult = () => {
          if (index < allResults.length) {
            results.value.push(allResults[index]);
            index++;
            // Her sonuç arasında 50ms bekleme
            setTimeout(addResult, 50); 
          } else {
            isFetching.value = false; // Tüm sonuçlar eklendi, yüklemeyi bitir
          }
        };
        addResult();
      } else {
        errorMessage.value = `API'den beklenen ${type} dizisi yerine başka bir veri tipi geldi veya sonuç yok.`;
        isFetching.value = false; // Sonuç yoksa yüklemeyi bitir
      }
    }

  } catch (error) {
    console.error('API Çekme Hatası:', error);
    errorMessage.value = 'Arama API sunucusuna bağlanılamadı. Lütfen vue.config.js dosyasını doğru yapılandırdığınızdan ve sunucunuzu yeniden başlattığınızdan emin olun.';
    isFetching.value = false; // Hata durumunda yüklemeyi bitir
  }
};

const handleSearch = () => {
  const query = searchQuery.value.trim();
  if (query !== '') {
    saveSearchQuery(query);
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('query', query);
    urlParams.set('type', currentType.value); 
    history.pushState(null, '', `?${urlParams.toString()}`);

    fetchResults(query, currentType.value); 
  }
};

const handleQuickSearch = () => {
  if (quickSearchQuery.value.trim() !== '') {
    searchQuery.value = quickSearchQuery.value;
    currentType.value = 'web';
    closeOverlay();
    handleSearch();
  }
};

const quickNavigate = (type) => {
  currentType.value = type;
  if (quickSearchQuery.value) {
    searchQuery.value = quickSearchQuery.value;
    handleSearch();
  }
  closeOverlay();
};

const switchTab = (type) => {
  currentType.value = type;
  if (searchQuery.value.trim() !== '') {
    handleSearch(); 
  } else {
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

const clearSearch = () => {
  searchQuery.value = '';
};

const handleBlur = () => {
  setTimeout(() => {
    showHistory.value = false;
  }, 200);
};

const openOverlay = (name) => {
  activeOverlay.value = name;
  if (name === 'controlCenter' || name === 'searchOptions') {
    document.body.classList.add('right-panel-active');
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
  alert('Settings saved!'); 
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

  if (urlQuery) {
    searchQuery.value = urlQuery;
    currentType.value = urlType || 'web'; 
    fetchResults(searchQuery.value, currentType.value);
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
  transition: color 0.2s ease-in-out;
}

.clear-search-button:hover {
  color: #FFFFFF;
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
  transition: color 0.2s ease-in-out;
}

.search-submit-button:hover {
  color: #005BB5;
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
  transition: background-color 0.2s;
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
  position: relative;
  padding-bottom: 1px;
  width: 100%;
  max-width: 700px;
}

.search-option-item {
  color: #8E8E93;
  font-weight: 500;
  font-size: 0.9rem;
  padding: 0.5rem 0.2rem;
  text-decoration: none;
  transition: color 0.2s ease-in-out;
  position: relative;
  z-index: 10;
}

.search-option-item:hover {
  color: #FFFFFF;
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
  margin-bottom: 1.5rem;
  margin-left: auto;
  margin-right: auto;
  margin-top: 1rem;
}

.results-wrapper {
  display: flex;
  width: 100%;
  max-width: 1100px;
  justify-content: center;
  margin-top: 2rem;
}

.results-container {
  flex-grow: 1;
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Yüklenme Göstergesi Stili */
.loading-indicator {
  text-align: center;
  padding: 2rem;
  color: #007AFF;
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
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  
  /* Aşamalı yükleme için temel stil */
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}

.result-card.loaded {
  /* Vue tarafından diziye eklendiğinde bu stil uygulanacak */
  opacity: 1;
  transform: translateY(0);
}

.result-link {
  display: flex;
  align-items: center;
}

.result-url-line {
  color: #8E8E93;
  font-size: 0.875rem;
  display: block;
  margin-bottom: 0.25rem;
  text-decoration: none;
  display: flex;
  align-items: center;
}

.result-url-line:hover {
  text-decoration: underline;
}

.favicon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.25rem;
  margin-top: -0.125rem;
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

.result-title a:hover {
  text-decoration: underline;
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
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
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
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
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
  transition: transform 0.2s;
}

.image-wrapper img:hover {
  transform: scale(1.05);
}

.image-caption {
  font-size: 0.75rem;
  color: #E0E0E0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
  padding: 0.25rem 0.1rem 0 0.1rem;
}

.video-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .video-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.video-card {
  background-color: #2C2C2E;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.video-thumbnail-link {
  display: block;
}

.video-thumbnail-link img {
  width: 100%;
  height: 10rem;
  object-fit: cover;
}

.video-info {
  padding: 0.75rem;
}

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

.video-title a:hover {
  text-decoration: underline;
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
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .news-card {
    flex-direction: row;
    align-items: flex-start;
    gap: 1rem;
  }
}

.news-thumbnail {
  width: 100%;
  height: 6rem;
  object-fit: cover;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

@media (min-width: 640px) {
  .news-thumbnail {
    width: 8rem;
  }
}

.news-content {
  flex-grow: 1;
}

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

.news-title a:hover {
  text-decoration: underline;
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

.news-date {
  margin-left: 0.5rem;
}

.wiki-card {
  background-color: #2C2C2E;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
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

.wiki-title a:hover {
  text-decoration: underline;
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

.wiki-source:hover {
  text-decoration: underline;
}

.no-results {
  text-align: center;
  color: #8E8E93;
  padding: 2rem 0;
}

.no-results-title {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
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
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
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
  z-index: 1001;
  background: none;
  border: none;
  padding: 0;
  font-size: 2rem;
  transition: color 0.2s ease-in-out;
}

.overlay-close:hover {
  color: #007aff;
}

.image-modal-content {
  background-color: #1a1a1a;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 36rem;
  width: 91.666667%;
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
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.modal-action-btn {
  padding: 0.5rem 1rem;
  background-color: #007aff;
  color: white;
  border-radius: 9999px;
  text-decoration: none;
  transition: background-color 0.2s;
}

.modal-action-btn:hover {
  background-color: #005bb5;
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
  color: white;
  text-align: left;
  overflow-y: auto;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
}

.slide-overlay.is-active .overlay-panel {
  transform: translateX(0);
}

.overlay-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  padding-left: 0.5rem;
}

.menu-container, .options-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1.5rem;
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
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: #3a3a3a;
}

.menu-item i {
  margin-right: 1rem;
  font-size: 1.5rem;
  color: #007aff;
}

.menu-item span {
  font-size: 0.95rem;
  font-weight: 500;
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
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #007aff;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.option-row {
  justify-content: space-between;
}

.custom-select {
  background-color: #2C2C2E;
  color: white;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #3a3a3a;
}

.save-settings-btn {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #007aff;
  color: white;
  border-radius: 9999px;
  border: none;
  font-weight: bold;
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

.grid-modal-content {
  background-color: #1a1a1a;
  padding: 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  width: 90%;
  max-width: 450px;
  border: 1px solid #333;
  transform: translateY(-30px);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.grid-view-overlay.is-active .grid-modal-content {
  transform: translateY(0);
}

.grid-title {
  font-size: 1.875rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  color: white;
  text-align: center;
}

.quick-search-form {
  width: 100%;
  margin-bottom: 1.5rem;
}

.quick-input-wrapper {
  position: relative;
}

.quick-search-input {
  width: 100%;
  border-radius: 9999px;
  background-color: #18181B;
  color: #e0e0e0;
  padding: 0.75rem 1.5rem 0.75rem 3rem;
  font-size: 1rem;
  border: 1px solid transparent;
}

.quick-search-input:focus {
  outline: none;
  box-shadow: 0 0 0 1px #007aff;
  background-color: #2a2a2a;
}

.quick-submit-btn {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
}

.quick-submit-btn:hover {
  color: white;
}

.quick-nav {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  text-decoration: none;
  color: white;
  transition: background-color 0.2s;
}

.quick-link:hover {
  background-color: #2a2a2a;
}

.quick-link i {
  color: #007aff;
}

body.right-panel-active .main-content,
body.right-panel-active .main-header {
  transform: translateX(-320px);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content, .main-header {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
