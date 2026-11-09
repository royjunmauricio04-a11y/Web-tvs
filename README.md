# TVS: Anime, Movies & Drama Hub

A modern, multi-catalog streaming hub for the web: a tribute to the DAVY mobile app, built with React, Vite, and compiled Tailwind CSS.

> 100% legal playback. No pirated content, ever. Built for personal use.

## Catalogs

| Catalog | Source | Playback |
| --- | --- | --- |
| Anime | Jikan API (MyAnimeList): seasonal, top rated, airing now | CC-licensed demo streams (Blender open movies) |
| Movies | iTunes trending top 50 + 20-topic featured search | Official iTunes trailers + demo streams |
| Series | iTunes trending TV seasons + 20-topic featured search | Official iTunes trailers + demo streams |
| Free Movies | Internet Archive, 48 public domain films | Full public domain films, streamed legally |
| K-Drama | Curated list | Demo streams |
| C-Drama | Curated list | Demo streams |

## Features

- Modern glass top navigation + mobile bottom nav
- Netflix-style hero carousel with auto-rotate on the home page
- Horizontal scroll rows with arrow navigation, including real iTunes trending rows (top movies and TV seasons)
- Continue watching: watch history with resume position and progress bars
- Watchlist with toast notifications
- Custom video player: playback speed (0.75x to 2x), skip 10s, volume, fullscreen, keyboard shortcuts
- Search across all six catalogs
- Fast: compiled Tailwind CSS (no CDN), small poster thumbnails, in-memory caching, instant detail pages
- Stream error handling with server switching
- 100% legal sources only (public domain films, official trailers, CC demo streams)

## Getting started

```bash
git clone https://github.com/royjunmauricio04-a11y/Web-tvs.git
cd Web-tvs
npm install
npm run dev
```

Then open http://localhost:3000.

## Production build + server

```bash
npm run build
npm start
```

The zero-dependency Node server (`server.js`) serves the built app from `dist/` with SPA fallback on port 3000 (or `$PORT`).

## Deploy to Render

This repo is ready for [Render](https://render.com) with zero extra config (`render.yaml` is included).

1. Sign up at [render.com](https://render.com) (Sign in with GitHub).
2. Grant Render access to this private repo when prompted.
3. On your Render dashboard, click **New + > Blueprint**, choose the **Web-tvs** repo, and click **Apply**.
4. Wait for the build to finish. Your app goes live at `https://web-tvs.onrender.com`.

Notes:

- The build command installs dev dependencies explicitly (`--include=dev`) because Render sets `NODE_ENV=production`.
- On the free plan, the service sleeps after ~15 minutes of inactivity. The first visit after idle takes about 30 to 60 seconds to wake up.
- Every push to `main` triggers an automatic redeploy.

## Keyboard shortcuts (player)

- Space / K: play or pause
- Left / Right arrow: back or forward 10 seconds
- Up / Down arrow: volume
- M: mute
- F: fullscreen

## Tech stack

- React 18 + Vite
- Tailwind CSS 3 (compiled at build time)
- framer-motion for transitions
- lucide-react icons
- react-router-dom v6

## Disclaimer

TVS only streams content that is legal to redistribute: public domain films from the Internet Archive, official trailers via iTunes, and Creative Commons demo streams (Blender open movies). Metadata comes from public APIs (Jikan/MyAnimeList, iTunes Search and RSS, Internet Archive).
