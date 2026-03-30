# TvMovieGuide 🎬

A website to discover the **latest trending movies and TV shows**, new releases across every major streaming platform, and physical media (Blu-Ray / DVD) — with ratings from TMDB, links to **Rotten Tomatoes**, and **IMDb**.

**Live site →** [https://homohabilis.github.io/TvMovieGuide/](https://homohabilis.github.io/TvMovieGuide/)

---

## Features

- 🔥 **Trending** — daily and weekly trending movies & TV shows
- 🎬 **Movies** — popular, in theaters, upcoming, and top-rated
- 📺 **TV Shows** — popular, on-the-air, airing today, and top-rated
- 📀 **New Releases** — filter by streaming platform or Blu-Ray / DVD window
  - Netflix · Disney+ · Max · Hulu · Prime Video · Apple TV+ · Peacock · Blu-Ray
- ⭐ **Ratings** — TMDB community score with direct links to Rotten Tomatoes & IMDb
- 🔍 **Search** — find any movie or TV show instantly
- 🎞️ **Detail panel** — cast, streaming providers, ratings, and external links per title

---

## Setup (GitHub Pages)

The site is a pure static app (HTML + CSS + Vanilla JS) — no build step required.

### 1. Enable GitHub Pages

In your repository go to **Settings → Pages** and set the source to the `main` branch, root folder (`/`). GitHub Pages will serve `index.html` automatically.

### 2. Get a free TMDB API key

The app uses the [TMDB API](https://www.themoviedb.org/) for all data. Obtaining a key is free and takes ~5 minutes:

1. Create an account at <https://www.themoviedb.org/signup>
2. Go to **Settings → API** and click **Create** → choose **Developer**
3. Copy your **API Key (v3 auth)**

### 3. Enter the key in the app

When you first open the site you will be prompted to enter your TMDB API key. The key is stored only in your browser's `localStorage` — it is never sent to any third-party server.

You can update the key at any time by clicking the **🔑 key icon** in the header.

---

## Data Sources

| Source | Used for |
|--------|----------|
| [TMDB](https://www.themoviedb.org/) | Trending, ratings, streaming providers, cast, details |
| [Rotten Tomatoes](https://www.rottentomatoes.com/) | Linked per title (search) |
| [IMDb](https://www.imdb.com/) | Linked per title (direct when IMDb ID available) |

> This product uses the TMDB API but is not endorsed or certified by TMDB.

---

## Tech stack

- Pure **HTML5 / CSS3 / Vanilla JavaScript** — zero dependencies, zero build step
- Fully responsive, dark theme
- Deployed via **GitHub Pages**
