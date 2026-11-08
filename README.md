# TVS: Anime, Movies & Drama Hub

A modern, multi-catalog streaming hub for the web: a tribute to the DAVY mobile app, rebuilt with React, Vite, and Tailwind CSS.

> 100% legal playback. No pirated content, ever. Built for personal use.

## Catalogs

| Catalog | Source | Playback |
| --- | --- | --- |
| Anime | Jikan API (MyAnimeList) | CC-licensed demo streams (Blender open movies) |
| Movies | iTunes Search API | Official iTunes trailers + demo streams |
| Series | iTunes Search API | Official iTunes trailers + demo streams |
| Free Movies | Internet Archive | Full public domain films, streamed legally |
| K-Drama | Curated list | Demo streams |
| C-Drama | Curated list | Demo streams |

## Features

- Modern glass top navigation + mobile bottom nav
- Netflix-style hero carousel with auto-rotate on the home page
- Horizontal scroll rows with arrow navigation (seasonal anime, top rated, featured movies/series)
- Continue watching: watch history with resume position and progress bars
- Watchlist with toast notifications
- Custom video player: playback speed (0.75x to 2x), skip 10s, volume, fullscreen, keyboard shortcuts
- Search across all six catalogs
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

## Keyboard shortcuts (player)

- Space / K: play or pause
- Left / Right arrow: back or forward 10 seconds
- Up / Down arrow: volume
- M: mute
- F: fullscreen

## Tech stack

- React 18 + Vite
- Tailwind CSS (via CDN)
- framer-motion for transitions
- lucide-react icons
- react-router-dom v6

## Disclaimer

TVS only streams content that is legal to redistribute: public domain films from the Internet Archive, official trailers via iTunes, and Creative Commons demo streams (Blender open movies). Metadata comes from public APIs (Jikan/MyAnimeList, iTunes Search, Internet Archive).
