// src/search/interfaces/search.interfaces.ts

// Define interfaces for better type safety
export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    displayUrl: string;
    source: 'Google' | 'Bing';
}

export interface NewsResult {
    news: string;
    link: string;
    snippet: string;
    source: string;
    image: string | null;
}

export interface ImageResult {
     image: string;
     thumbnail: string;
     title: string;
     link: string;
}

export interface VideoResult {
    title: string;
    url: string; // Corrected URL format - note: your original URLs like https://www.youtube.com/watch?v=$... still look suspicious. Standard format is https://www.youtube.com/watch?v=<ID>
    thumbnail: string;
    source: string;
}

export interface WikiSummary {
    title: string;
    summary: string;
    img: string | null;
    url: string;
}

// CacheItem can remain internal to the service if not used in public interfaces
/*
export interface CacheItem<T> {
    data: T;
    expiry: number;
}
*/
