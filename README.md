# TVS

TVS is a multi-catalog viewer for **anime, movies, TV series, free public domain films, K-dramas and C-dramas**, built as a web tribute to the [DAVY](https://github.com/AsfhtgkDavid/davy) Android app. Browse a catalog, open a title, pick an episode, trailer, or full public domain movie, and play it in the built-in player.

![catalogs](https://img.shields.io/badge/catalogs-anime%20%7C%20movies%20%7C%20series%20%7C%20free%20%7C%20K--drama%20%7C%20C--drama-8b5cf6)
![license](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Anime**: seasonal lineups (now airing plus recent seasons), full episode lists, live search via Jikan/MyAnimeList
- **Movies**: featured films with real posters, descriptions, and official trailers
- **Series**: popular TV shows with season info and episode lists
- **Free Movies**: full-length public domain films streamed from the Internet Archive (classics, noir, sci-fi, horror) - real complete movies, not trailers
- **K-Drama and C-Drama**: curated catalogs with local search
- **Built-in player**: play/pause, seek bar, skip 10s, volume, fullscreen, auto-hiding controls, keyboard shortcuts, next episode, server switching
- **Watchlist**: bookmark titles from any catalog, saved locally
- **SUB/DUB selector** like the original DAVY translation switcher
- Dark, responsive UI with mobile and desktop layouts
- **Zero-backend design**: no database, no API keys, no server-side code required for the app itself

## Tech stack

- React 18 + Vite
- React Router
- Tailwind CSS v4
- framer-motion (transitions)
- lucide-react (icons)
- Node.js built-in static server (optional, for self-hosting, no dependencies)

## Data sources and playback

This project only uses free, public, and legal sources:

| Catalog | Source | What actually plays |
| --- | --- | --- |
| Anime | [Jikan API](https://jikan.moe) (unofficial MyAnimeList API) | Real metadata and episode lists; demo streams |
| Movies | [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html) | Real posters and descriptions; official trailers |
| Series | iTunes Search API | Real season info and episode counts; demo streams |
| Free Movies | [Internet Archive](https://archive.org) | **Full public domain films**, complete movies |
| K-Drama / C-Drama | Built-in curated catalog | Curated metadata; demo streams |
| Demo streams | [Blender Foundation open movies](https://studio.blender.org/films/) | Big Buck Bunny, Sintel, Elephants Dream, Tears of Steel (CC licensed) |

**Playback policy**: TVS does not host, link, or stream pirated content. For movies it plays the official trailer served by the iTunes API; for the Free Movies catalog it streams complete public domain films from the Internet Archive; for other catalogs it plays open-licensed demo streams so the player experience can be demonstrated end to end. Video files stream directly from the source (Internet Archive or Apple); this app never proxies or stores media.

## Getting started

```bash
git clone https://github.com/royjunmauricio04-a11y/Web-tvs.git
cd Web-tvs
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Running your own server

The app is a static frontend, so any static host works. A zero-dependency Node server is included for self-hosting:

```bash
npm run build          # build the app into ./dist
npm run serve          # serve it at http://localhost:8080
```

Or in one command:

```bash
npm start              # build + serve
```

Use a custom port with `PORT=3000 npm run serve`. The server includes SPA fallback so React Router deep links work.

### Free hosting options

No server needed at all on these platforms, they host the static build for you:

- **Vercel**: import the repo, framework preset "Vite", deploy
- **Netlify**: build command `npm run build`, publish directory `dist`
- **Cloudflare Pages**: same settings as Netlify
- **GitHub Pages**: set base path in vite.config.js, use `gh-pages` or an Actions workflow

For GitHub Pages specifically, add `base: "/Web-tvs/"` to the Vite config since the app is served from a subpath.

## Keyboard shortcuts (player)

| Key | Action |
| --- | --- |
| Space / K | Play or pause |
| Left / Right arrow | Seek 10s back or forward |
| Up / Down arrow | Volume up or down |
| M | Mute |
| F | Fullscreen |

## Roadmap

- [x] Multi-catalog browsing (anime, movies, series, free, K-drama, C-drama)
- [x] Built-in player with server switching
- [x] Full public domain movies from the Internet Archive
- [x] Search per catalog
- [x] Watchlist
- [x] Optional self-hosting server included
- [ ] Continue watching / watch history
- [ ] TV mode with focus-based navigation
- [ ] User ratings and comments

## Credits

- Inspiration: [DAVY](https://github.com/AsfhtgkDavid/davy) by AsfhtgkDavid
- Anime data: Jikan API, MyAnimeList
- Movie and series data: iTunes Search API
- Public domain films: Internet Archive
- Demo videos: Blender Foundation open movies

## License

[MIT](LICENSE)
