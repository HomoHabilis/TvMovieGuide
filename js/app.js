'use strict';

/* =============================================================
   TvMovieGuide — Main Application
   ============================================================= */

/** Milliseconds in one day */
const MS_PER_DAY = 86_400_000;

/* ---------------------------------------------------------------
   State
   --------------------------------------------------------------- */
const State = {
  section: 'trending',
  trending: {
    window: 'week', type: 'all',
    releaseType: 'released', period: 'month', platform: 'all', genre: 'all',
  },
  movies: {
    sort: 'rating',
    releaseType: 'released', period: 'month', platform: 'all', genre: 'all',
  },
  tv: {
    sort: 'rating',
    releaseType: 'released', period: 'month', platform: 'all', genre: 'all',
  },
  releases: {
    releaseType: 'released',  // 'released' | 'theaters' | 'upcoming'
    period:      'month',     // 'week' | 'month' | '3months' | 'year'
    platform:    'all',       // 'all' | TMDB provider ID | 'bluray'
    genre:       'all',       // GENRE_FILTERS[n].id
  },
  search:   { query: '' },
  heroItem: null,
};

/* ---------------------------------------------------------------
   DOM helpers
   --------------------------------------------------------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const el = id => document.getElementById(id);

/* ---------------------------------------------------------------
   Boot
   --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (ApiKeyManager.exists()) {
    launchApp();
  } else {
    showSetupModal();
  }
  bindSetupEvents();
});

/* ---------------------------------------------------------------
   Setup modal
   --------------------------------------------------------------- */
function showSetupModal() {
  el('setup-modal').classList.remove('hidden');
  el('app').classList.add('hidden');
}

function hideSetupModal() {
  el('setup-modal').classList.add('hidden');
  el('app').classList.remove('hidden');
}

function bindSetupEvents() {
  el('save-api-key').addEventListener('click', handleSaveKey);
  el('api-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSaveKey();
  });
  el('settings-btn').addEventListener('click', () => {
    el('api-key-input').value = ApiKeyManager.get() || '';
    el('api-key-error').textContent = '';
    el('setup-modal').classList.remove('hidden');
  });
}

async function handleSaveKey() {
  const keyInput = el('api-key-input');
  const errSpan  = el('api-key-error');
  const key = keyInput.value.trim();

  if (!key) {
    errSpan.textContent = 'Please enter your API key.';
    keyInput.focus();
    return;
  }

  const btn = el('save-api-key');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating…';
  errSpan.textContent = '';

  try {
    await API.validateKey(key);
    ApiKeyManager.set(key);
    hideSetupModal();
    launchApp();
  } catch (err) {
    errSpan.textContent =
      err.message === 'INVALID_KEY'
        ? 'Invalid API key — please check and try again.'
        : 'Could not connect to TMDB. Check your internet connection.';
    keyInput.focus();
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play"></i> Launch TvMovieGuide';
  }
}

/* ---------------------------------------------------------------
   App launch
   --------------------------------------------------------------- */
function launchApp() {
  hideSetupModal();
  initFilters();
  bindAppEvents();
  navigateTo('trending');
}

/* ---------------------------------------------------------------
   Release-type / period / platform filter definitions
   --------------------------------------------------------------- */
const RELEASE_TYPE_DEFS = [
  { id: 'released', label: 'Available Now', sub: 'Streaming &amp; Disc', icon: 'fa-play-circle' },
  { id: 'theaters', label: 'In Theaters',   sub: 'Currently in cinemas', icon: 'fa-film' },
  { id: 'upcoming', label: 'Coming Soon',   sub: 'Not yet released',     icon: 'fa-calendar-alt' },
];

const PLATFORM_DEFS = [
  { id: 'all',    html: '<i class="fas fa-globe"></i> All' },
  { id: '8',      html: '<span class="pf-icon netflix">N</span> Netflix' },
  { id: '337',    html: '<span class="pf-icon disney">D+</span> Disney+' },
  { id: '1899',   html: '<span class="pf-icon max">M</span> Max' },
  { id: '15',     html: '<span class="pf-icon hulu">H</span> Hulu' },
  { id: '9',      html: '<span class="pf-icon prime">P</span> Prime Video' },
  { id: '350',    html: '<span class="pf-icon apple">A</span> Apple TV+' },
  { id: '386',    html: '<span class="pf-icon peacock">🦚</span> Peacock' },
  { id: 'bluray', html: '<i class="fas fa-compact-disc"></i> Blu-Ray / DVD' },
];

/* ---------------------------------------------------------------
   buildSectionFilters — dynamically populates release-type tabs,
   period buttons, and platform buttons for a given section prefix.
   Each section's buttons are fully independent (scoped to their
   own containers) and update only their own State subtree.
   --------------------------------------------------------------- */
function buildSectionFilters(prefix, state, onLoad) {
  // Release type tabs
  const rtRow = el(`${prefix}-rtype-row`);
  if (rtRow) {
    RELEASE_TYPE_DEFS.forEach(rt => {
      const btn = document.createElement('button');
      btn.className = 'release-type-btn' + (rt.id === state.releaseType ? ' active' : '');
      btn.dataset.rtype = rt.id;
      btn.innerHTML = `<i class="fas ${rt.icon}"></i><span class="rtype-label">${rt.label}</span><span class="rtype-sub">${rt.sub}</span>`;
      btn.addEventListener('click', () => {
        $$('.release-type-btn', rtRow).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.releaseType = rt.id;
        updateSectionFilterVisibility(prefix, rt.id);
        onLoad(true);
      });
      rtRow.appendChild(btn);
    });
  }

  // Period buttons
  const periodBtns = el(`${prefix}-period-btns`);
  if (periodBtns) {
    CONFIG.RELEASE_PERIODS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'period-btn' + (p.id === state.period ? ' active' : '');
      btn.dataset.period = p.id;
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        $$('.period-btn', periodBtns).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.period = p.id;
        onLoad(true);
      });
      periodBtns.appendChild(btn);
    });
  }

  // Platform buttons
  const platformBtns = el(`${prefix}-platform-btns`);
  if (platformBtns) {
    PLATFORM_DEFS.forEach(pf => {
      const btn = document.createElement('button');
      btn.className = 'platform-btn' + (pf.id === state.platform ? ' active' : '');
      btn.dataset.platform = pf.id;
      btn.innerHTML = pf.html;
      btn.addEventListener('click', () => {
        $$('.platform-btn', platformBtns).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.platform = pf.id;
        onLoad(true);
      });
      platformBtns.appendChild(btn);
    });
  }

  updateSectionFilterVisibility(prefix, state.releaseType);
}

/* ---------------------------------------------------------------
   Genre buttons — generated from CONFIG.GENRE_FILTERS.
   buildGenreButtons() is called once per section container.
   Each container manages its own active state independently.
   --------------------------------------------------------------- */
function buildGenreButtons(containerId, onSelect) {
  const container = el(containerId);
  if (!container) return;
  CONFIG.GENRE_FILTERS.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'genre-btn' + (g.id === 'all' ? ' active' : '');
    btn.dataset.genre = g.id;
    btn.textContent = g.label;
    btn.addEventListener('click', () => {
      $$('.genre-btn', container).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(g.id);
    });
    container.appendChild(btn);
  });
}

function initFilters() {
  buildSectionFilters('trending', State.trending, loadTrending);
  buildSectionFilters('movies',   State.movies,   loadMovies);
  buildSectionFilters('tv',       State.tv,       loadTV);

  buildGenreButtons('trending-genre-row', id => { State.trending.genre = id; loadTrending(true); });
  buildGenreButtons('movies-genre-row',   id => { State.movies.genre   = id; loadMovies(true);   });
  buildGenreButtons('tv-genre-row',       id => { State.tv.genre       = id; loadTV(true);       });
  buildGenreButtons('genre-filter-row',   id => { State.releases.genre = id; loadReleases(true); });
}

/* ---------------------------------------------------------------
   Show/hide period + platform rows based on release type
   --------------------------------------------------------------- */
function updateSectionFilterVisibility(prefix, releaseType) {
  const isReleased = releaseType === 'released';
  const periodRow   = el(`${prefix}-period-row`);
  const platformRow = el(`${prefix}-platform-row`);
  if (periodRow)   periodRow.classList.toggle('hidden', !isReleased);
  if (platformRow) platformRow.classList.toggle('hidden', !isReleased);
}

/* ---------------------------------------------------------------
   Navigation
   --------------------------------------------------------------- */
function navigateTo(section) {
  State.section = section;

  // toggle nav buttons
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  // toggle sections
  const allSections = ['trending', 'movies', 'tv', 'releases', 'search'];
  allSections.forEach(s => {
    const sec = el(`${s}-section`);
    if (sec) sec.classList.toggle('hidden', s !== section);
  });

  // Show/hide hero (visible on trending)
  const hero = el('hero-section');
  hero.classList.toggle('hidden', section !== 'trending');

  // Load section data if not already loaded
  switch (section) {
    case 'trending': loadTrending(); break;
    case 'movies':   loadMovies();   break;
    case 'tv':       loadTV();       break;
    case 'releases': loadReleases(); break;
  }
}

/* ---------------------------------------------------------------
   Event bindings (app)
   --------------------------------------------------------------- */
function bindAppEvents() {
  // Nav buttons
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });
  el('logo-home').addEventListener('click', e => {
    e.preventDefault();
    navigateTo('trending');
  });

  // Trending toggles — time window
  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.trending.window = btn.dataset.window;
      loadTrending(true);
    });
  });

  // Trending toggles — media type
  $$('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.trending.type = btn.dataset.type;
      loadTrending(true);
    });
  });

  // Movies sort buttons
  $$('.movies-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.movies-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.movies.sort = btn.dataset.sort;
      loadMovies(true);
    });
  });

  // TV sort buttons
  $$('.tv-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tv-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.tv.sort = btn.dataset.sort;
      loadTV(true);
    });
  });

  // New Releases section: platform, release-type, period (scoped to avoid
  // conflicting with the same classes dynamically built in other sections)
  const releasesSection = el('releases-section');

  $$('.platform-btn', releasesSection).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.platform-btn', releasesSection).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.releases.platform = btn.dataset.platform;
      loadReleases(true);
    });
  });

  $$('.release-type-btn', releasesSection).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.release-type-btn', releasesSection).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.releases.releaseType = btn.dataset.rtype;
      updateSectionFilterVisibility('releases', btn.dataset.rtype);
      loadReleases(true);
    });
  });

  $$('.period-btn', releasesSection).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.period-btn', releasesSection).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.releases.period = btn.dataset.period;
      loadReleases(true);
    });
  });

  // Search
  const searchInput = el('search-input');
  const searchBtn   = el('search-btn');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchInput.value), 500);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') runSearch(searchInput.value);
  });
  searchBtn.addEventListener('click', () => runSearch(searchInput.value));

  // Detail modal close
  el('modal-close').addEventListener('click', closeDetailModal);
  el('detail-modal').addEventListener('click', e => {
    if (e.target === el('detail-modal')) closeDetailModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetailModal();
  });
}

/* ---------------------------------------------------------------
   Data loaders
   --------------------------------------------------------------- */

async function loadTrending(force = false) {
  const grid    = el('trending-grid');
  const spinner = el('trending-loading');

  if (!force && grid.children.length > 0) return;

  setLoading(spinner, true);
  grid.innerHTML = '';

  const { window: timeWindow, type, releaseType, period, platform, genre } = State.trending;
  const genreConf  = CONFIG.GENRE_FILTERS.find(g => g.id === genre) || CONFIG.GENRE_FILTERS[0];
  const movieGenre = genreConf.movieId ? String(genreConf.movieId) : undefined;
  const tvGenre    = genreConf.tvId    ? String(genreConf.tvId)    : undefined;
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];

  try {
    let items;

    if (releaseType === 'theaters') {
      // In Theaters / On The Air
      let movieItems = [];
      let tvItems    = [];
      if (type === 'movie' || type === 'all') {
        const data = movieGenre
          ? await API.discoverMovies({
              sort_by: 'popularity.desc',
              'primary_release_date.gte': fmt(new Date(today.getTime() - 30 * MS_PER_DAY)),
              'primary_release_date.lte': fmt(today),
              with_genres: movieGenre,
            })
          : await API.movies('now_playing');
        movieItems = (data.results || []).map(m => ({ ...m, media_type: 'movie', release_label: '🎥 In Theaters' }));
      }
      if (type === 'tv' || type === 'all') {
        const data = tvGenre
          ? await API.discoverTV({ sort_by: 'popularity.desc', with_genres: tvGenre })
          : await API.tvShows('on_the_air');
        tvItems = (data.results || []).map(s => ({ ...s, media_type: 'tv', release_label: '📺 On The Air' }));
      }
      items = [...movieItems, ...tvItems].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    } else if (releaseType === 'upcoming') {
      // Coming Soon — next 90 days
      const tomorrow  = new Date(today.getTime() + MS_PER_DAY);
      const ninetyOut = new Date(today.getTime() + 90 * MS_PER_DAY);
      let movieItems = [];
      let tvItems    = [];
      if (type === 'movie' || type === 'all') {
        const data = await API.discoverMovies({
          'primary_release_date.gte': fmt(tomorrow),
          'primary_release_date.lte': fmt(ninetyOut),
          sort_by: 'popularity.desc',
          ...(movieGenre ? { with_genres: movieGenre } : {}),
        });
        movieItems = (data.results || []).map(m => ({ ...m, media_type: 'movie', release_label: '📅 Coming Soon' }));
      }
      if (type === 'tv' || type === 'all') {
        const data = await API.discoverTV({
          'first_air_date.gte': fmt(tomorrow),
          'first_air_date.lte': fmt(ninetyOut),
          sort_by: 'popularity.desc',
          ...(tvGenre ? { with_genres: tvGenre } : {}),
        });
        tvItems = (data.results || []).map(s => ({ ...s, media_type: 'tv', release_label: '📅 Coming Soon' }));
      }
      items = [...movieItems, ...tvItems].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    } else {
      // Available Now — use native trending unless platform/genre filters are active
      const useNative = genre === 'all' && platform === 'all';

      if (useNative) {
        const data = await API.trending(type, timeWindow);
        items = (data.results || []).filter(
          i => i.media_type === 'movie' || i.media_type === 'tv'
        );
      } else {
        const periodConf    = CONFIG.RELEASE_PERIODS.find(p => p.id === period) || CONFIG.RELEASE_PERIODS[1];
        const since         = new Date(today.getTime() - periodConf.days * MS_PER_DAY);
        const providerExtra = platform === 'all' ? {} : { with_watch_providers: platform, watch_region: CONFIG.REGION };
        let movieItems = [];
        let tvItems    = [];

        if (type === 'movie' || type === 'all') {
          if (platform === 'bluray') {
            const data = await API.discoverMovies({
              'primary_release_date.gte': fmt(new Date(today.getTime() - 180 * MS_PER_DAY)),
              'primary_release_date.lte': fmt(new Date(today.getTime() - 42  * MS_PER_DAY)),
              sort_by: 'popularity.desc',
              ...(movieGenre ? { with_genres: movieGenre } : {}),
            });
            movieItems = (data.results || []).map(m => ({ ...m, media_type: 'movie', release_label: '📀 Blu-Ray / DVD' }));
          } else {
            const data = await API.discoverMovies({
              'primary_release_date.gte': fmt(since),
              'primary_release_date.lte': fmt(today),
              sort_by: 'popularity.desc',
              ...(movieGenre ? { with_genres: movieGenre } : {}),
              ...providerExtra,
            });
            movieItems = (data.results || []).map(m => ({ ...m, media_type: 'movie' }));
          }
        }
        if ((type === 'tv' || type === 'all') && platform !== 'bluray') {
          const data = await API.discoverTV({
            'first_air_date.gte': fmt(since),
            'first_air_date.lte': fmt(today),
            sort_by: 'popularity.desc',
            ...(tvGenre ? { with_genres: tvGenre } : {}),
            ...providerExtra,
          });
          tvItems = (data.results || []).map(s => ({ ...s, media_type: 'tv' }));
        }
        items = [...movieItems, ...tvItems].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      }
    }

    if (items.length > 0) renderHero(items[0]);
    renderGrid(items, grid);
  } catch (err) {
    handleError(err, grid);
  } finally {
    setLoading(spinner, false);
  }
}

async function loadMovies(force = false) {
  const grid    = el('movies-grid');
  const spinner = el('movies-loading');

  if (!force && grid.children.length > 0) return;

  setLoading(spinner, true);
  grid.innerHTML = '';

  const { sort, releaseType, period, platform, genre } = State.movies;
  const genreConf  = CONFIG.GENRE_FILTERS.find(g => g.id === genre) || CONFIG.GENRE_FILTERS[0];
  const movieGenre = genreConf.movieId ? String(genreConf.movieId) : undefined;
  const today      = new Date();
  const fmt        = d => d.toISOString().split('T')[0];
  const sortBy     = sort === 'rating' ? 'vote_average.desc' : 'popularity.desc';

  try {
    let data;

    if (releaseType === 'theaters') {
      // In Theaters: always sort by popularity — current releases don't have enough votes
      // for a meaningful rating sort (most in-cinema titles have fewer than 200 votes).
      if (movieGenre) {
        data = await API.discoverMovies({
          sort_by: 'popularity.desc',
          'primary_release_date.gte': fmt(new Date(today.getTime() - 30 * MS_PER_DAY)),
          'primary_release_date.lte': fmt(today),
          with_genres: movieGenre,
        });
      } else {
        data = await API.movies('now_playing');
      }

    } else if (releaseType === 'upcoming') {
      // Coming soon
      const tomorrow  = new Date(today.getTime() + MS_PER_DAY);
      const ninetyOut = new Date(today.getTime() + 90 * MS_PER_DAY);
      data = await API.discoverMovies({
        'primary_release_date.gte': fmt(tomorrow),
        'primary_release_date.lte': fmt(ninetyOut),
        sort_by: 'primary_release_date.asc',
        ...(movieGenre ? { with_genres: movieGenre } : {}),
      });

    } else {
      // Available Now
      if (platform === 'bluray') {
        // Blu-Ray/DVD window (6 weeks – 6 months ago); skip vote threshold — disc releases
        // are recent enough that many haven't accumulated 200 votes yet.
        data = await API.discoverMovies({
          'primary_release_date.gte': fmt(new Date(today.getTime() - 180 * MS_PER_DAY)),
          'primary_release_date.lte': fmt(new Date(today.getTime() - 42  * MS_PER_DAY)),
          sort_by: sortBy,
          ...(movieGenre ? { with_genres: movieGenre } : {}),
        });
      } else if (movieGenre || platform !== 'all') {
        // Period + genre/platform filter; skip vote threshold for same reason
        const periodConf    = CONFIG.RELEASE_PERIODS.find(p => p.id === period) || CONFIG.RELEASE_PERIODS[1];
        const since         = new Date(today.getTime() - periodConf.days * MS_PER_DAY);
        const providerExtra = platform === 'all' ? {} : { with_watch_providers: platform, watch_region: CONFIG.REGION };
        data = await API.discoverMovies({
          'primary_release_date.gte': fmt(since),
          'primary_release_date.lte': fmt(today),
          sort_by: sortBy,
          ...(movieGenre ? { with_genres: movieGenre } : {}),
          ...providerExtra,
        });
      } else {
        // No filters — standard TMDB top-rated / popular endpoint (full library, all-time)
        data = await API.movies(sort === 'rating' ? 'top_rated' : 'popular');
      }
    }

    renderGrid((data.results || []).map(m => ({ ...m, media_type: 'movie' })), grid);
  } catch (err) {
    handleError(err, grid);
  } finally {
    setLoading(spinner, false);
  }
}

async function loadTV(force = false) {
  const grid    = el('tv-grid');
  const spinner = el('tv-loading');

  if (!force && grid.children.length > 0) return;

  setLoading(spinner, true);
  grid.innerHTML = '';

  const { sort, releaseType, period, platform, genre } = State.tv;
  const genreConf = CONFIG.GENRE_FILTERS.find(g => g.id === genre) || CONFIG.GENRE_FILTERS[0];
  const tvGenre   = genreConf.tvId ? String(genreConf.tvId) : undefined;
  const today     = new Date();
  const fmt       = d => d.toISOString().split('T')[0];
  const sortBy    = sort === 'rating' ? 'vote_average.desc' : 'popularity.desc';

  try {
    let data;

    if (releaseType === 'theaters') {
      // On the air: always sort by popularity — current shows lack enough votes for rating sort
      if (tvGenre) {
        data = await API.discoverTV({
          sort_by: 'popularity.desc',
          ...(tvGenre ? { with_genres: tvGenre } : {}),
        });
      } else {
        data = await API.tvShows('on_the_air');
      }

    } else if (releaseType === 'upcoming') {
      // Coming soon TV
      const tomorrow  = new Date(today.getTime() + MS_PER_DAY);
      const ninetyOut = new Date(today.getTime() + 90 * MS_PER_DAY);
      data = await API.discoverTV({
        'first_air_date.gte': fmt(tomorrow),
        'first_air_date.lte': fmt(ninetyOut),
        sort_by: 'first_air_date.asc',
        ...(tvGenre ? { with_genres: tvGenre } : {}),
      });

    } else {
      // Available Now
      if (platform === 'bluray') {
        // Blu-ray is movies-only; fall back to standard TV endpoint
        data = await API.tvShows(sort === 'rating' ? 'top_rated' : 'popular');
      } else if (tvGenre || platform !== 'all') {
        // Period + genre/platform; skip vote threshold — recent shows won't have 200 votes
        const periodConf    = CONFIG.RELEASE_PERIODS.find(p => p.id === period) || CONFIG.RELEASE_PERIODS[1];
        const since         = new Date(today.getTime() - periodConf.days * MS_PER_DAY);
        const providerExtra = platform === 'all' ? {} : { with_watch_providers: platform, watch_region: CONFIG.REGION };
        data = await API.discoverTV({
          'first_air_date.gte': fmt(since),
          'first_air_date.lte': fmt(today),
          sort_by: sortBy,
          ...(tvGenre ? { with_genres: tvGenre } : {}),
          ...providerExtra,
        });
      } else {
        // No filters — standard TMDB top-rated / popular endpoint (full library, all-time)
        data = await API.tvShows(sort === 'rating' ? 'top_rated' : 'popular');
      }
    }

    renderGrid((data.results || []).map(s => ({ ...s, media_type: 'tv' })), grid);
  } catch (err) {
    handleError(err, grid);
  } finally {
    setLoading(spinner, false);
  }
}

async function loadReleases(force = false) {
  const grid    = el('releases-grid');
  const spinner = el('releases-loading');

  if (!force && grid.children.length > 0) return;

  setLoading(spinner, true);
  grid.innerHTML = '';

  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const { releaseType, period, platform, genre } = State.releases;

  // Resolve genre filter params for movies and TV (fall back to 'all' if not found)
  const genreConf  = CONFIG.GENRE_FILTERS.find(g => g.id === genre) || CONFIG.GENRE_FILTERS[0];
  const movieGenre = genreConf.movieId ? String(genreConf.movieId) : undefined;
  const tvGenre    = genreConf.tvId    ? String(genreConf.tvId)    : undefined;

  /** Returns true when an item's genre_ids include genreId (or no filter is set). */
  const matchesGenre = (item, genreId) =>
    !genreId || (item.genre_ids || []).includes(genreId);

  try {
    let movieItems = [];
    let tvItems    = [];

    if (releaseType === 'theaters') {
      /* ---- In Theaters: now playing movies + currently airing TV ---- */
      const [movies, tv] = await Promise.all([
        API.movies('now_playing'),
        API.tvShows('on_the_air'),
      ]);
      // Post-filter by genre (genre_ids returned by the endpoint)
      movieItems = (movies.results || [])
        .filter(m => matchesGenre(m, genreConf.movieId))
        .map(m => ({ ...m, media_type: 'movie', release_label: '🎥 In Theaters' }));
      tvItems = (tv.results || [])
        .filter(s => matchesGenre(s, genreConf.tvId))
        .map(s => ({ ...s, media_type: 'tv', release_label: '📺 On The Air' }));

    } else if (releaseType === 'upcoming') {
      /* ---- Coming Soon: next 90 days ---- */
      const tomorrow  = new Date(today.getTime() + MS_PER_DAY);
      const ninetyOut = new Date(today.getTime() + 90 * MS_PER_DAY);
      const [movies, tv] = await Promise.all([
        API.discoverMovies({
          'primary_release_date.gte': fmt(tomorrow),
          'primary_release_date.lte': fmt(ninetyOut),
          sort_by: 'primary_release_date.asc',
          ...(movieGenre ? { with_genres: movieGenre } : {}),
        }),
        API.discoverTV({
          'first_air_date.gte': fmt(tomorrow),
          'first_air_date.lte': fmt(ninetyOut),
          sort_by: 'first_air_date.asc',
          ...(tvGenre ? { with_genres: tvGenre } : {}),
        }),
      ]);
      movieItems = (movies.results || []).map(m => ({
        ...m, media_type: 'movie', release_label: '📅 Coming Soon',
      }));
      tvItems = (tv.results || []).map(s => ({
        ...s, media_type: 'tv', release_label: '📅 Coming Soon',
      }));

    } else {
      /* ---- Available Now (released) ---- */
      const periodConf = CONFIG.RELEASE_PERIODS.find(p => p.id === period) || CONFIG.RELEASE_PERIODS[1];
      const since = new Date(today - periodConf.days * MS_PER_DAY);

      if (platform === 'bluray') {
        // Blu-Ray/DVD: typical theatrical-to-disc window (6 weeks – 6 months ago)
        const sixMonthsAgo = new Date(today - 180 * MS_PER_DAY);
        const sixWeeksAgo  = new Date(today - 42  * MS_PER_DAY);
        const movies = await API.discoverMovies({
          'primary_release_date.gte': fmt(sixMonthsAgo),
          'primary_release_date.lte': fmt(sixWeeksAgo),
          'vote_count.gte': 20,
          ...(movieGenre ? { with_genres: movieGenre } : {}),
        });
        movieItems = (movies.results || []).map(m => ({
          ...m, media_type: 'movie', release_label: '📀 Blu-Ray / DVD',
        }));

      } else {
        const baseMovieParams = {
          'primary_release_date.gte': fmt(since),
          'primary_release_date.lte': fmt(today),
          ...(movieGenre ? { with_genres: movieGenre } : {}),
        };
        const baseTVParams = {
          'first_air_date.gte': fmt(since),
          'first_air_date.lte': fmt(today),
          ...(tvGenre ? { with_genres: tvGenre } : {}),
        };

        const providerExtra = platform === 'all'
          ? {}
          : { with_watch_providers: platform, watch_region: CONFIG.REGION };

        const [movies, tv] = await Promise.all([
          API.discoverMovies({ ...baseMovieParams, ...providerExtra }),
          API.discoverTV({    ...baseTVParams,    ...providerExtra }),
        ]);
        movieItems = (movies.results || []).map(m => ({ ...m, media_type: 'movie' }));
        tvItems    = (tv.results    || []).map(s => ({ ...s, media_type: 'tv' }));
      }
    }

    // Sort: upcoming by release date asc; everything else by popularity desc
    const sortFn = releaseType === 'upcoming'
      ? (a, b) => {
          const da = a.release_date || a.first_air_date || '';
          const db = b.release_date || b.first_air_date || '';
          return da.localeCompare(db);
        }
      : (a, b) => (b.popularity || 0) - (a.popularity || 0);

    const combined = [...movieItems, ...tvItems].sort(sortFn);

    if (combined.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-satellite-dish fa-3x"></i>
          <p>No releases found for this filter.</p>
        </div>`;
    } else {
      renderGrid(combined, grid);
    }
  } catch (err) {
    handleError(err, grid);
  } finally {
    setLoading(spinner, false);
  }
}

/* ---------------------------------------------------------------
   Search
   --------------------------------------------------------------- */
async function runSearch(query) {
  query = (query || '').trim();
  if (!query) {
    navigateTo(State.section === 'search' ? 'trending' : State.section);
    return;
  }

  if (State.search.query === query && el('search-results').children.length > 0) return;
  State.search.query = query;

  navigateTo('search');

  const grid    = el('search-results');
  const spinner = el('search-loading');
  const empty   = el('search-empty');
  const count   = el('search-count');

  setLoading(spinner, true);
  grid.innerHTML = '';
  empty.classList.add('hidden');

  try {
    const data = await API.search(query);
    const items = (data.results || []).filter(
      i => i.media_type === 'movie' || i.media_type === 'tv'
    );

    count.textContent = items.length > 0
      ? `${items.length} result${items.length !== 1 ? 's' : ''} for "${query}"`
      : '';

    if (items.length === 0) {
      empty.classList.remove('hidden');
    } else {
      renderGrid(items, grid);
    }
  } catch (err) {
    handleError(err, grid);
  } finally {
    setLoading(spinner, false);
  }
}

/* ---------------------------------------------------------------
   Hero section
   --------------------------------------------------------------- */
function renderHero(item) {
  if (!item) return;
  State.heroItem = item;

  const heroSec  = el('hero-section');
  const backdrop = el('hero-backdrop');
  const title    = el('hero-title');
  const year     = el('hero-year');
  const type     = el('hero-type');
  const overview = el('hero-overview');
  const ratings  = el('hero-ratings');
  const tmdbLink = el('hero-tmdb-link');
  const imdbLink = el('hero-imdb-link');
  const rtLink   = el('hero-rt-link');

  const isMovie   = item.media_type === 'movie';
  const itemTitle = item.title || item.name || 'Untitled';
  const itemDate  = item.release_date || item.first_air_date || '';
  const yearStr   = itemDate ? itemDate.slice(0, 4) : '';

  // Backdrop
  const backdropSrc = API.backdropUrl(item.backdrop_path);
  if (backdropSrc) {
    backdrop.src = backdropSrc;
    backdrop.alt = itemTitle;
  }

  title.textContent    = itemTitle;
  year.textContent     = yearStr;
  type.textContent     = isMovie ? '🎬 Movie' : '📺 TV Show';
  overview.textContent = item.overview || '';

  // Rating
  const score = item.vote_average || 0;
  const pct   = Math.round(score * 10);
  const cls   = ratingClass(pct);
  ratings.innerHTML = `
    <div class="rating-badge ${cls}" title="TMDB Score">
      <span class="rating-num">${pct}%</span>
      <span class="rating-label">TMDB</span>
    </div>
    <a href="https://www.rottentomatoes.com/search?search=${encodeURIComponent(itemTitle)}"
       target="_blank" rel="noopener" class="rating-link rt-link" title="Find on Rotten Tomatoes">
      <i class="fas fa-circle rt-icon"></i> Rotten Tomatoes ↗
    </a>
    <a href="https://www.imdb.com/find?q=${encodeURIComponent(itemTitle)}&s=tt&ttype=${isMovie ? 'ft' : 'tv'}"
       target="_blank" rel="noopener" class="rating-link imdb-link" title="Find on IMDb">
      <span class="imdb-badge">IMDb</span> ↗
    </a>`;

  // Links
  const tmdbType = isMovie ? 'movie' : 'tv';
  tmdbLink.href = `https://www.themoviedb.org/${tmdbType}/${item.id}`;
  imdbLink.href = `https://www.imdb.com/find?q=${encodeURIComponent(itemTitle)}&s=tt&ttype=${isMovie ? 'ft' : 'tv'}`;
  rtLink.href   = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(itemTitle)}`;

  heroSec.classList.remove('hidden');
}

/* ---------------------------------------------------------------
   Card grid rendering
   --------------------------------------------------------------- */
function renderGrid(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-film fa-3x"></i>
        <p>Nothing to show here yet.</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const card = createCard(item);
    if (card) fragment.appendChild(card);
  });
  container.appendChild(fragment);
}

function createCard(item) {
  if (!item) return null;

  const isMovie   = item.media_type === 'movie';
  const itemTitle = item.title || item.name || 'Unknown';
  const itemDate  = item.release_date || item.first_air_date || '';
  const yearStr   = itemDate ? itemDate.slice(0, 4) : '—';
  const score     = item.vote_average || 0;
  const pct       = Math.round(score * 10);
  const cls       = ratingClass(pct);
  const posterSrc = API.posterUrl(item.poster_path);

  const div = document.createElement('div');
  div.className = 'card';
  div.setAttribute('role', 'button');
  div.setAttribute('tabindex', '0');
  div.setAttribute('aria-label', `${itemTitle} (${yearStr})`);
  div.dataset.id   = item.id;
  div.dataset.type = item.media_type;

  div.innerHTML = `
    <div class="card-poster">
      ${posterSrc
        ? `<img src="${posterSrc}" alt="${escHtml(itemTitle)}" loading="lazy">`
        : `<div class="card-no-poster"><i class="fas fa-film"></i></div>`
      }
      <div class="card-rating ${cls}">${pct}<span>%</span></div>
      <div class="card-type-badge">${isMovie ? '🎬' : '📺'}</div>
    </div>
    <div class="card-body">
      <h3 class="card-title">${escHtml(itemTitle)}</h3>
      <div class="card-meta">
        <span class="card-year">${yearStr}</span>
        ${item.release_label ? `<span class="card-platform-badge">${item.release_label}</span>` : ''}
      </div>
    </div>`;

  div.addEventListener('click', () => openDetailModal(item.id, item.media_type));
  div.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetailModal(item.id, item.media_type);
    }
  });

  return div;
}

/* ---------------------------------------------------------------
   Detail Modal
   --------------------------------------------------------------- */
function openDetailModal(id, mediaType) {
  const modal = el('detail-modal');
  const body  = el('detail-body');

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  body.innerHTML = `
    <div class="detail-loading">
      <div class="spinner"></div>
      <p>Loading details…</p>
    </div>`;

  document.body.style.overflow = 'hidden';

  const fetcher = mediaType === 'movie' ? API.movieDetails(id) : API.tvDetails(id);
  fetcher
    .then(details => renderDetailModal(details, mediaType))
    .catch(() => {
      body.innerHTML = `<p class="error-msg">Could not load details. Please try again.</p>`;
    });
}

function closeDetailModal() {
  const modal = el('detail-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // Clear content to stop any playing trailer
  el('detail-body').innerHTML = '';
}

function renderDetailModal(d, mediaType) {
  const isMovie = mediaType === 'movie';
  const title   = d.title || d.name || 'Unknown';
  const year    = (d.release_date || d.first_air_date || '').slice(0, 4);
  const score   = d.vote_average || 0;
  const pct     = Math.round(score * 10);
  const cls     = ratingClass(pct);

  // Runtime
  let runtime = '';
  if (isMovie && d.runtime) {
    const h = Math.floor(d.runtime / 60);
    const m = d.runtime % 60;
    runtime = h > 0 ? `${h}h ${m}m` : `${m}m`;
  } else if (!isMovie && d.episode_run_time && d.episode_run_time[0]) {
    runtime = `~${d.episode_run_time[0]}m / ep`;
  }

  // Genres
  const genres = (d.genres || []).map(g => `<span class="genre-tag">${escHtml(g.name)}</span>`).join('');

  // Backdrop / poster
  const backdropSrc = API.backdropUrl(d.backdrop_path);
  const posterSrc   = API.posterUrl(d.poster_path, 'w342');

  // Cast
  const cast = (d.credits && d.credits.cast ? d.credits.cast.slice(0, 6) : []);
  const castHTML = cast.map(c => `
    <div class="cast-item">
      ${c.profile_path
        ? `<img src="${API.posterUrl(c.profile_path, 'w92')}" alt="${escHtml(c.name)}" loading="lazy">`
        : `<div class="cast-no-photo"><i class="fas fa-user"></i></div>`
      }
      <span class="cast-name">${escHtml(c.name)}</span>
      <span class="cast-char">${escHtml(c.character || '')}</span>
    </div>`).join('');

  // Streaming providers (US)
  const providers  = d['watch/providers'] && d['watch/providers'].results
    ? d['watch/providers'].results[CONFIG.REGION] || {}
    : {};
  const flatrate   = providers.flatrate || [];
  const rent       = providers.rent     || [];
  const buy        = providers.buy      || [];

  function providerBadges(list) {
    if (!list.length) return '<span class="no-provider">—</span>';
    return list.map(p => {
      const logoSrc = API.posterUrl(p.logo_path, 'w92');
      const info    = CONFIG.PROVIDERS[p.provider_id];
      return `<span class="provider-chip" title="${escHtml(p.provider_name)}">
        ${logoSrc
          ? `<img src="${logoSrc}" alt="${escHtml(p.provider_name)}">`
          : `<span class="provider-fallback ${info ? info.cls : ''}">${info ? info.icon : p.provider_name[0]}</span>`
        }
      </span>`;
    }).join('');
  }

  // External links
  const imdbId  = d.external_ids && d.external_ids.imdb_id;
  const tmdbUrl = `https://www.themoviedb.org/${mediaType}/${d.id}`;
  const imdbUrl = imdbId
    ? `https://www.imdb.com/title/${imdbId}`
    : `https://www.imdb.com/find?q=${encodeURIComponent(title)}&s=tt`;
  const rtUrl   = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;

  // Overview
  const overview = d.overview || 'No overview available.';

  // Trailer (YouTube — first official trailer, fallback to any YouTube video)
  // Single-pass: priority order official Trailer > Trailer > any YouTube
  const videos = d.videos?.results || [];
  let trailer = null;
  for (const v of videos) {
    if (v.site !== 'YouTube') continue;
    if (v.type === 'Trailer' && v.official) { trailer = v; break; }
    if (v.type === 'Trailer' && !trailer)   { trailer = v; }
    else if (!trailer)                       { trailer = v; }
  }
  // Only embed keys that look like valid YouTube IDs (alphanumeric, - _)
  const safeKey = trailer && /^[\w-]{6,20}$/.test(trailer.key) ? trailer.key : null;
  const trailerHTML = safeKey
    ? `<div class="detail-trailer">
         <h3 class="streaming-title"><i class="fab fa-youtube"></i> Trailer</h3>
         <div class="trailer-wrap">
           <iframe
             src="https://www.youtube-nocookie.com/embed/${safeKey}?rel=0"
             title="${escHtml(trailer.name || 'Trailer')}"
             loading="lazy"
             allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
             allowfullscreen></iframe>
         </div>
       </div>`
    : '';

  // Status
  const status = d.status || '';

  el('detail-body').innerHTML = `
    ${backdropSrc ? `<div class="detail-backdrop"><img src="${backdropSrc}" alt="${escHtml(title)}"></div>` : ''}
    <div class="detail-content">
      <div class="detail-poster-wrap">
        ${posterSrc ? `<img class="detail-poster" src="${posterSrc}" alt="${escHtml(title)}">` : ''}
      </div>
      <div class="detail-info">
        <h2 class="detail-title">${escHtml(title)}</h2>
        <div class="detail-meta">
          ${year   ? `<span class="meta-tag">${escHtml(year)}</span>` : ''}
          ${runtime? `<span class="meta-tag"><i class="fas fa-clock"></i> ${escHtml(runtime)}</span>` : ''}
          ${status ? `<span class="meta-tag">${escHtml(status)}</span>` : ''}
          <span class="meta-tag">${isMovie ? '🎬 Movie' : '📺 TV Show'}</span>
        </div>
        <div class="detail-genres">${genres}</div>

        <!-- Ratings -->
        <div class="detail-ratings">
          <div class="rating-circle ${cls}">
            <svg viewBox="0 0 36 36" class="rating-svg">
              <path class="rating-bg" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="rating-fill" stroke-dasharray="${pct}, 100"
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <div class="rating-text">
              <span class="rating-pct">${pct}%</span>
              <span class="rating-src">TMDB</span>
            </div>
          </div>
          <div class="external-ratings">
            <a href="${rtUrl}" target="_blank" rel="noopener" class="ext-rating-btn rt-btn">
              <i class="fas fa-circle"></i> Rotten Tomatoes ↗
            </a>
            <a href="${imdbUrl}" target="_blank" rel="noopener" class="ext-rating-btn imdb-btn">
              <span class="imdb-badge-sm">IMDb</span> Score ↗
            </a>
          </div>
        </div>

        <!-- Overview -->
        <p class="detail-overview">${escHtml(overview)}</p>

        <!-- Trailer -->
        ${trailerHTML}

        <!-- Streaming -->
        ${flatrate.length || rent.length || buy.length ? `
        <div class="streaming-section">
          <h3 class="streaming-title"><i class="fas fa-play-circle"></i> Where to Watch (${CONFIG.REGION})</h3>
          ${flatrate.length ? `
          <div class="streaming-row">
            <span class="streaming-label">Stream</span>
            <div class="provider-list">${providerBadges(flatrate)}</div>
          </div>` : ''}
          ${rent.length ? `
          <div class="streaming-row">
            <span class="streaming-label">Rent</span>
            <div class="provider-list">${providerBadges(rent)}</div>
          </div>` : ''}
          ${buy.length ? `
          <div class="streaming-row">
            <span class="streaming-label">Buy</span>
            <div class="provider-list">${providerBadges(buy)}</div>
          </div>` : ''}
        </div>` : `
        <div class="streaming-section">
          <p class="no-provider-msg"><i class="fas fa-info-circle"></i> No streaming data available for ${CONFIG.REGION}.</p>
        </div>`}

        <!-- Cast -->
        ${castHTML ? `
        <div class="cast-section">
          <h3 class="cast-title"><i class="fas fa-users"></i> Cast</h3>
          <div class="cast-grid">${castHTML}</div>
        </div>` : ''}

        <!-- External links -->
        <div class="detail-links">
          <a href="${tmdbUrl}" target="_blank" rel="noopener" class="detail-link-btn tmdb-btn">
            <i class="fas fa-database"></i> TMDB
          </a>
          <a href="${imdbUrl}" target="_blank" rel="noopener" class="detail-link-btn imdb-btn-full">
            <span class="imdb-badge-sm">IMDb</span>
          </a>
          <a href="${rtUrl}" target="_blank" rel="noopener" class="detail-link-btn rt-btn-full">
            <i class="fas fa-circle rt-icon-sm"></i> Rotten Tomatoes
          </a>
        </div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Utilities
   --------------------------------------------------------------- */

function ratingClass(pct) {
  if (pct >= 70) return 'rating-green';
  if (pct >= 40) return 'rating-yellow';
  if (pct  > 0)  return 'rating-red';
  return 'rating-none';
}

function setLoading(spinnerEl, visible) {
  if (spinnerEl) spinnerEl.classList.toggle('hidden', !visible);
}

function handleError(err, container) {
  const isKey = err.message === 'INVALID_KEY' || err.message === 'NO_KEY';
  container.innerHTML = `
    <div class="error-state">
      <i class="fas fa-exclamation-triangle fa-2x"></i>
      <p>${isKey
        ? 'Invalid or missing API key. <a href="#" id="err-rekey">Update key</a>'
        : 'Failed to load content. Please try again later.'
      }</p>
    </div>`;
  if (isKey) {
    const link = container.querySelector('#err-rekey');
    if (link) link.addEventListener('click', e => {
      e.preventDefault();
      showSetupModal();
    });
  }
}

/** Escape HTML special chars */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
