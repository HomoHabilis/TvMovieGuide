'use strict';

/* =============================================================
   TvMovieGuide — Configuration & Utilities
   ============================================================= */

const CONFIG = {
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p',
  POSTER_SIZE: 'w500',
  BACKDROP_SIZE: 'w1280',
  SMALL_POSTER_SIZE: 'w185',
  /** Replaced by the GitHub Actions deployment workflow via the TMDB_API_KEY secret. */
  API_KEY: '__TMDB_API_KEY__',
  REGION: 'US',
  LANGUAGE: 'en-US',
  CACHE_DURATION_MINUTES: 5,
  get CACHE_TTL() { return this.CACHE_DURATION_MINUTES * 60 * 1000; },

  /** TMDB watch provider IDs for common streaming services */
  PROVIDERS: {
    8:    { name: 'Netflix',     cls: 'netflix',  icon: 'N'  },
    337:  { name: 'Disney+',     cls: 'disney',   icon: 'D+' },
    1899: { name: 'Max',         cls: 'max',      icon: 'M'  },
    15:   { name: 'Hulu',        cls: 'hulu',     icon: 'H'  },
    9:    { name: 'Prime Video', cls: 'prime',    icon: 'P'  },
    350:  { name: 'Apple TV+',   cls: 'apple',    icon: 'A'  },
    386:  { name: 'Peacock',     cls: 'peacock',  icon: '🦚' },
    531:  { name: 'Paramount+',  cls: 'paramount',icon: 'P+' },
    283:  { name: 'Crunchyroll', cls: 'crunchyroll', icon: 'CR' },
  },

  /** Provider IDs used in the Releases filter buttons */
  PLATFORM_FILTER_IDS: ['all', '8', '337', '1899', '15', '9', '350', '386', 'bluray'],

  /**
   * Genre filter options for the Releases section.
   * movieId / tvId map to TMDB genre IDs for each media type.
   * null means "no genre filter".
   */
  GENRE_FILTERS: [
    { id: 'all',      label: 'All Genres',         movieId: null,  tvId: null  },
    { id: 'action',   label: 'Action',              movieId: 28,    tvId: 10759 },
    { id: 'anime',    label: 'Animation & Anime',   movieId: 16,    tvId: 16    },
    { id: 'comedy',   label: 'Comedy',              movieId: 35,    tvId: 35    },
    { id: 'drama',    label: 'Drama',               movieId: 18,    tvId: 18    },
    { id: 'horror',   label: 'Horror',              movieId: 27,    tvId: 9648  },
    { id: 'romance',  label: 'Romance',             movieId: 10749, tvId: 10749 },
    { id: 'scifi',    label: 'Sci-Fi & Fantasy',    movieId: 878,   tvId: 10765 },
    { id: 'thriller', label: 'Thriller',            movieId: 53,    tvId: 80    },
  ],

  /** Release period options (days back from today) for the "Available Now" view */
  RELEASE_PERIODS: [
    { id: 'week',    label: 'Last Week',      days: 7   },
    { id: 'month',   label: 'Last Month',     days: 30  },
    { id: '3months', label: 'Last 3 Months',  days: 90  },
    { id: 'year',    label: 'Last Year',      days: 365 },
  ],
};

/* ---------------------------------------------------------------
   In-memory cache with TTL
   --------------------------------------------------------------- */
const Cache = {
  _data: {},

  get(key) {
    const entry = this._data[key];
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      delete this._data[key];
      return null;
    }
    return entry.value;
  },

  set(key, value, ttl = CONFIG.CACHE_TTL) {
    this._data[key] = { value, expires: Date.now() + ttl };
  },
};
