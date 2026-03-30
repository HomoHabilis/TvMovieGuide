'use strict';

/* =============================================================
   TvMovieGuide — TMDB API Wrapper
   ============================================================= */

const API = {

  /**
   * Core fetch with caching, auth, and error normalisation.
   * @param {string} endpoint  - TMDB path, e.g. '/trending/all/week'
   * @param {Object} params    - Extra query params
   */
  async request(endpoint, params = {}) {
    const apiKey = ApiKeyManager.get();
    if (!apiKey) throw new Error('NO_KEY');

    const url = new URL(`${CONFIG.TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('language', CONFIG.LANGUAGE);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    }

    const cacheKey = url.toString();
    const cached = Cache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 401) throw new Error('INVALID_KEY');
      if (response.status === 404) throw new Error('NOT_FOUND');
      throw new Error(`HTTP_${response.status}`);
    }
    const data = await response.json();
    Cache.set(cacheKey, data);
    return data;
  },

  /* ---------- Trending ---------- */

  /**
   * @param {'all'|'movie'|'tv'} mediaType
   * @param {'day'|'week'} timeWindow
   */
  trending(mediaType = 'all', timeWindow = 'week') {
    return this.request(`/trending/${mediaType}/${timeWindow}`);
  },

  /* ---------- Movies ---------- */

  /**
   * @param {'popular'|'now_playing'|'upcoming'|'top_rated'} category
   */
  movies(category = 'popular', page = 1) {
    return this.request(`/movie/${category}`, { page, region: CONFIG.REGION });
  },

  /* ---------- TV Shows ---------- */

  /**
   * @param {'popular'|'on_the_air'|'airing_today'|'top_rated'} category
   */
  tvShows(category = 'popular', page = 1) {
    return this.request(`/tv/${category}`, { page });
  },

  /* ---------- Search ---------- */

  search(query, page = 1) {
    return this.request('/search/multi', { query: query.trim(), page });
  },

  /* ---------- Details ---------- */

  movieDetails(id) {
    return this.request(`/movie/${id}`, {
      append_to_response: 'watch/providers,release_dates,external_ids,credits,videos',
    });
  },

  tvDetails(id) {
    return this.request(`/tv/${id}`, {
      append_to_response: 'watch/providers,content_ratings,external_ids,credits,videos',
    });
  },

  /* ---------- Discover (for Releases section) ---------- */

  /**
   * Discover movies with optional streaming provider filter.
   * @param {Object} filters
   */
  discoverMovies(filters = {}) {
    return this.request('/discover/movie', {
      sort_by: 'popularity.desc',
      include_adult: false,
      ...filters,
    });
  },

  /**
   * Discover TV shows with optional streaming provider filter.
   */
  discoverTV(filters = {}) {
    return this.request('/discover/tv', {
      sort_by: 'popularity.desc',
      include_adult: false,
      ...filters,
    });
  },

  /* ---------- Validation ---------- */

  async validateKey(key) {
    const url = new URL(`${CONFIG.TMDB_BASE_URL}/configuration`);
    url.searchParams.set('api_key', key);
    const res = await fetch(url.toString());
    if (res.status === 401) throw new Error('INVALID_KEY');
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return true;
  },

  /* ---------- Image helpers ---------- */

  posterUrl(path, size = CONFIG.POSTER_SIZE) {
    if (!path) return null;
    return `${CONFIG.TMDB_IMAGE_BASE}/${size}${path}`;
  },

  backdropUrl(path) {
    if (!path) return null;
    return `${CONFIG.TMDB_IMAGE_BASE}/${CONFIG.BACKDROP_SIZE}${path}`;
  },
};
