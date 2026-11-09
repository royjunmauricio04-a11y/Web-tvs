
export const JIKAN = "https://api.jikan.moe/v4";

export const ITUNES = "https://itunes.apple.com";

export const CATALOGS = [
  { id: "anime", label: "Anime", blurb: "Seasonal lineups from MyAnimeList" },
  { id: "movies", label: "Movies", blurb: "Feature films with official trailers" },
  { id: "series", label: "Series", blurb: "Popular TV series" },
  { id: "free", label: "Free Movies", blurb: "Full public domain films from the Internet Archive" },
  { id: "kdrama", label: "K-Drama", blurb: "Korean drama catalog" },
  { id: "cdrama", label: "C-Drama", blurb: "Chinese drama catalog" },
];

export const DEMO_SOURCES = [
  { id: "demo1", label: "Demo: Big Buck Bunny", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { id: "demo2", label: "Demo: Sintel", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  { id: "demo3", label: "Demo: Elephants Dream", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
  { id: "demo4", label: "Demo: Tears of Steel", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" },
];

/* ---------- Internet Archive (public domain full movies) ---------- */
export const IA = "https://archive.org";

/* Proxy-first JSON fetch: tries our own /api cache proxy, then falls back to the upstream API. */
