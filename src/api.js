import { IA, ITUNES, JIKAN } from "./constants";
import { posterSvg } from "./art";

export const memCache = new Map();

export async function proxied(name, base, path) {
  const key = name + path;
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.v;
  for (const url of [`/api/${name}${path}`, base + path]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("json")) continue; // SPA fallback returned html (e.g. vite dev)
      const v = await r.json();
      memCache.set(key, { t: Date.now(), v });
      return v;
    } catch { /* try next */ }
  }
  return null;
}

export async function ia(path) {
  return proxied("ia", IA, path);
}

export function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function normIA(doc) {
  return {
    id: String(doc.identifier), catalog: "free",
    title: String(doc.title || doc.identifier), altTitle: null,
    image: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
    score: null, genres: ["Public domain"], episodes: 1,
    year: doc.year ? String(doc.year) : null, type: "Movie",
    synopsis: doc.description ? stripHtml(doc.description) : "A public domain film streamed from the Internet Archive.",
    video: null,
  };
}

export const FREE_FALLBACK = [
  { identifier: "his_girl_friday", title: "His Girl Friday", year: 1940, description: "A newspaper editor schemes to keep his ex-wife and star reporter on the story of a lifetime." },
  { identifier: "night_of_the_living_dead", title: "Night of the Living Dead", year: 1968, description: "Strangers barricade a farmhouse against the recently dead, risen by a passing radiation wave." },
  { identifier: "house_on_haunted_hill_ipod", title: "House on Haunted Hill", year: 1959, description: "A millionaire offers five guests a fortune to survive a night in a haunted mansion." },
  { identifier: "TheFastandtheFuriousJohnIreland1954goofyrip", title: "The Fast and the Furious", year: 1955, description: "A fugitive races a sports car across the country and picks up a woman along the way." },
  { identifier: "VoyagetothePlanetofPrehistoricWomen", title: "Voyage to the Planet of Prehistoric Women", year: 1967, description: "Cosmonauts explore Venus and awaken ancient dangers beneath its seas." },
  { identifier: "charlie_chaplin_film_fest", title: "Charlie Chaplin Festival", year: 1938, description: "A collection of classic Charlie Chaplin short comedies." },
];

export async function featuredFree() {
  const q = "mediatype:movies AND collection:(feature_films OR Film_Noir OR SciFi_Horror)";
  const res = await ia(`/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=24&page=1&output=json&sort%5B%5D=${encodeURIComponent("downloads desc")}`);
  const docs = res && res.response && Array.isArray(res.response.docs) ? res.response.docs : null;
  if (!docs || !docs.length) return FREE_FALLBACK.map(normIA);
  return docs.slice(0, 24).map(normIA).map(remember);
}

export const iaVideoCache = new Map();

export async function fetchIAVideo(id) {
  if (iaVideoCache.has(id)) return iaVideoCache.get(id);
  const res = await ia(`/metadata/${encodeURIComponent(id)}`);
  const files = res && Array.isArray(res.files) ? res.files : [];
  const pick = (fn) => files.find(fn);
  const f =
    pick((x) => x.format === "h.264" && /\.mp4$/i.test(x.name || "")) ||
    pick((x) => x.format === "512Kb MPEG4" && /\.mp4$/i.test(x.name || "")) ||
    pick((x) => /\.mp4$/i.test(x.name || "")) ||
    pick((x) => /\.ogv$/i.test(x.name || ""));
  const url = f ? `${IA}/download/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}` : null;
  iaVideoCache.set(id, url);
  return url;
}

/* ---------- generic fetch helpers ---------- */
export async function api(path) {
  return proxied("jikan", JIKAN, path);
}

export async function itunes(path) {
  return proxied("itunes", ITUNES, path);
}

export function bigArt(url) {
  return url ? String(url).replace(/\/\d+x\d+bb\./, "/600x600bb.") : null;
}

/* ---------- anime fallback (offline) ---------- */
export const MOCK_ANIME = [
  { id: "52991", title: "Sousou no Frieren", english: "Frieren: Beyond Journey's End", japanese: "葬送のフリーレン", score: 9.1, episodes: 28, year: 2023, season: "fall", type: "TV", genres: ["Adventure", "Fantasy", "Drama"], synopsis: "After the hero's party defeats the Demon King, the elf mage Frieren sets out on a quiet journey to truly understand the humans she traveled with." },
  { id: "40748", title: "Jujutsu Kaisen 2nd Season", english: "Jujutsu Kaisen 2nd Season", japanese: "呪術廻戦", score: 8.7, episodes: 23, year: 2023, season: "summer", type: "TV", genres: ["Action", "Supernatural", "Shounen"], synopsis: "Yuji Itadori and his fellow jujutsu sorcerers face cursed spirits of increasing power while uncovering the dark past of their strongest teacher." },
  { id: "21", title: "One Piece", english: "One Piece", japanese: "ワンピース", score: 8.7, episodes: null, year: 1999, season: "fall", type: "TV", genres: ["Adventure", "Fantasy", "Shounen"], synopsis: "Monkey D. Luffy sails the Grand Line with his crew, chasing the legendary treasure known as the One Piece." },
  { id: "50265", title: "Spy x Family", english: "Spy x Family", japanese: "SPY×FAMILY", score: 8.5, episodes: 12, year: 2022, season: "spring", type: "TV", genres: ["Comedy", "Action", "Slice of Life"], synopsis: "A master spy builds a fake family for a mission, unaware his wife is an assassin and his daughter reads minds." },
  { id: "52034", title: "Oshi no Ko", english: "Oshi no Ko", japanese: "推しの子", score: 8.6, episodes: 11, year: 2023, season: "spring", type: "TV", genres: ["Drama", "Supernatural", "Mystery"], synopsis: "A doctor is reborn as the son of a pop idol and grows up inside the dazzling, ruthless world of show business." },
  { id: "44511", title: "Chainsaw Man", english: "Chainsaw Man", japanese: "チェンソーマン", score: 8.5, episodes: 12, year: 2022, season: "fall", type: "TV", genres: ["Action", "Horror", "Shounen"], synopsis: "Denji merges with his chainsaw devil dog and joins a public safety unit hunting devils across a gritty modern Japan." },
  { id: "47917", title: "Bocchi the Rock!", english: "Bocchi the Rock!", japanese: "ぼっち・ざ・ろっく！", score: 8.8, episodes: 12, year: 2022, season: "fall", type: "TV", genres: ["Comedy", "Music", "Slice of Life"], synopsis: "A painfully shy guitarist joins a band and slowly finds her voice, one anxiety-fueled performance at a time." },
  { id: "37521", title: "Vinland Saga", english: "Vinland Saga", japanese: "ヴィンランド・サガ", score: 8.8, episodes: 24, year: 2019, season: "summer", type: "TV", genres: ["Action", "Adventure", "Historical"], synopsis: "Thorfinn, son of a warrior, chases revenge across the Viking wars before learning what a true warrior really is." },
  { id: "32182", title: "Mob Psycho 100", english: "Mob Psycho 100", japanese: "モブサイコ100", score: 8.5, episodes: 12, year: 2016, season: "summer", type: "TV", genres: ["Action", "Comedy", "Supernatural"], synopsis: "A powerful but unassuming psychic works part-time for a fake exorcist while keeping his emotions in check." },
  { id: "38000", title: "Kimetsu no Yaiba", english: "Demon Slayer: Kimetsu no Yaiba", japanese: "鬼滅の刃", score: 8.5, episodes: 26, year: 2019, season: "spring", type: "TV", genres: ["Action", "Fantasy", "Shounen"], synopsis: "Tanjiro joins the Demon Slayer Corps to find a cure for his sister, who was turned into a demon." },
];

export function mockAnime(m) {
  return {
    id: m.id, catalog: "anime", title: m.title, altTitle: m.english, jap: m.japanese,
    image: posterSvg(m.id, m.english || m.title, "anime"),
    score: m.score, genres: m.genres, episodes: m.episodes || 24,
    year: m.year, season: m.season, type: m.type, synopsis: m.synopsis, video: null,
  };
}

export const MOCK_SEASON = MOCK_ANIME.map(mockAnime);

export const MOCK_ANIME_BY_ID = new Map(MOCK_ANIME.map((m) => [m.id, mockAnime(m)]));

/* ---------- movie & series fallback (offline) ---------- */
export const MOVIE_FALLBACK = [
  { id: "f1", title: "Interstellar", altTitle: "Christopher Nolan", score: 8.7, episodes: 1, year: 2014, type: "Movie", genres: ["Sci-Fi", "Adventure"], synopsis: "Explorers push through a wormhole to find humanity a new home as Earth slowly dies." },
  { id: "f2", title: "Inception", altTitle: "Christopher Nolan", score: 8.8, episodes: 1, year: 2010, type: "Movie", genres: ["Sci-Fi", "Thriller"], synopsis: "A thief who steals secrets from dreams takes on one last job: planting an idea." },
  { id: "f3", title: "The Dark Knight", altTitle: "Christopher Nolan", score: 9.0, episodes: 1, year: 2008, type: "Movie", genres: ["Action", "Crime"], synopsis: "Batman faces the Joker, a criminal who wants to prove that everyone can be broken." },
  { id: "f4", title: "Parasite", altTitle: "Bong Joon-ho", score: 8.5, episodes: 1, year: 2019, type: "Movie", genres: ["Thriller", "Drama"], synopsis: "A poor family schemes its way into a wealthy household with escalating consequences." },
  { id: "f5", title: "Mad Max: Fury Road", altTitle: "George Miller", score: 8.6, episodes: 1, year: 2015, type: "Movie", genres: ["Action", "Adventure"], synopsis: "In a post-apocalyptic wasteland, two rebels flee a tyrant in a high-octance road war." },
  { id: "f6", title: "Everything Everywhere All at Once", altTitle: "Daniels", score: 8.7, episodes: 1, year: 2022, type: "Movie", genres: ["Sci-Fi", "Comedy"], synopsis: "A laundromat owner must connect with parallel-universe versions of herself to save the multiverse." },
  { id: "f7", title: "Spider-Man: Across the Spider-Verse", altTitle: "Joaquim Dos Santos", score: 8.6, episodes: 1, year: 2023, type: "Movie", genres: ["Animation", "Action"], synopsis: "Miles Morales leaps across dimensions and clashes with a whole society of Spider-People." },
  { id: "f8", title: "Oppenheimer", altTitle: "Christopher Nolan", score: 8.4, episodes: 1, year: 2023, type: "Movie", genres: ["Drama", "History"], synopsis: "The story of the physicist who led the race to build the atomic bomb." },
].map((m) => ({ ...m, catalog: "movies", image: null, synopsis: m.synopsis, video: null }));

export const SERIES_FALLBACK = [
  { id: "s1", title: "Breaking Bad", altTitle: "5 seasons", score: 9.5, episodes: 62, year: 2008, type: "TV Series", genres: ["Crime", "Drama"], synopsis: "A chemistry teacher with cancer builds a drug empire and loses himself along the way." },
  { id: "s2", title: "Friends", altTitle: "10 seasons", score: 8.9, episodes: 236, year: 1994, type: "TV Series", genres: ["Comedy", "Romance"], synopsis: "Six friends navigate love, work, and coffee in New York City." },
  { id: "s3", title: "The Office", altTitle: "9 seasons", score: 9.0, episodes: 201, year: 2005, type: "TV Series", genres: ["Comedy"], synopsis: "A mockumentary about the everyday absurdity of a paper company office." },
  { id: "s4", title: "Game of Thrones", altTitle: "8 seasons", score: 9.2, episodes: 73, year: 2011, type: "TV Series", genres: ["Fantasy", "Drama"], synopsis: "Noble houses wage war for the Iron Throne while an ancient threat rises in the north." },
  { id: "s5", title: "Stranger Things", altTitle: "4 seasons", score: 8.7, episodes: 42, year: 2016, type: "TV Series", genres: ["Sci-Fi", "Horror"], synopsis: "Kids in a small town face supernatural forces from a hidden parallel dimension." },
  { id: "s6", title: "Suits", altTitle: "9 seasons", score: 8.5, episodes: 134, year: 2011, type: "TV Series", genres: ["Drama"], synopsis: "A brilliant college dropout talks his way into a top law firm." },
  { id: "s7", title: "Peaky Blinders", altTitle: "6 seasons", score: 8.8, episodes: 36, year: 2013, type: "TV Series", genres: ["Crime", "Drama"], synopsis: "A gangster family climbs from the streets of Birmingham toward political power." },
  { id: "s8", title: "The Last of Us", altTitle: "1 season", score: 8.7, episodes: 9, year: 2023, type: "TV Series", genres: ["Drama", "Thriller"], synopsis: "A smuggler escorts a teenage girl who may hold the key to a fungal pandemic's cure." },
].map((m) => ({ ...m, catalog: "series", image: null, video: null }));

/* ---------- curated K-drama catalog ---------- */
export const KDRAMAS = [
  { id: "cloy", title: "Crash Landing on You", altTitle: "사랑의 불시착", score: 9.2, episodes: 16, year: 2019, type: "K-Drama", genres: ["Romance", "Drama"], synopsis: "A paragliding accident drops a South Korean heiress into North Korea, where a stoic army captain hides and protects her." },
  { id: "goblin", title: "Goblin", altTitle: "Guardian: The Lonely and Great God", score: 9.0, episodes: 16, year: 2016, type: "K-Drama", genres: ["Fantasy", "Romance"], synopsis: "An immortal goblin searching for an end to his long life meets the human bride destined to release him." },
  { id: "dots", title: "Descendants of the Sun", altTitle: "태양의 후예", score: 8.5, episodes: 16, year: 2016, type: "K-Drama", genres: ["Action", "Romance"], synopsis: "A special forces captain and an ER surgeon fall in love amid disaster zones and peacekeeping missions." },
  { id: "vincenzo", title: "Vincenzo", altTitle: "빈센조", score: 8.7, episodes: 20, year: 2021, type: "K-Drama", genres: ["Crime", "Comedy"], synopsis: "A Korean-Italian mafia consigliere returns home and serves justice to an untouchable conglomerate." },
  { id: "itaewon", title: "Itaewon Class", altTitle: "이태원 클라쓰", score: 8.4, episodes: 16, year: 2020, type: "K-Drama", genres: ["Drama", "Business"], synopsis: "An ex-convict opens a bar in Itaewon and grows it into a company that challenges the empire that ruined his life." },
  { id: "hometown", title: "Hometown Cha-Cha-Cha", altTitle: "갯마을 차차차", score: 8.6, episodes: 16, year: 2021, type: "K-Drama", genres: ["Romance", "Comedy"], synopsis: "A pragmatic dentist moves to a seaside village and falls for the handyman who helps everyone in town." },
  { id: "woo", title: "Extraordinary Attorney Woo", altTitle: "이상한 변호사 우영우", score: 8.9, episodes: 16, year: 2022, type: "K-Drama", genres: ["Legal", "Drama"], synopsis: "A brilliant lawyer on the autism spectrum wins impossible cases with warmth and courage." },
  { id: "glory", title: "The Glory", altTitle: "더 글로리", score: 8.6, episodes: 16, year: 2022, type: "K-Drama", genres: ["Thriller", "Drama"], synopsis: "A school violence survivor plots a meticulous revenge on her tormentors, years later, on her own terms." },
  { id: "squid", title: "Squid Game", altTitle: "오징어 게임", score: 8.0, episodes: 9, year: 2021, type: "K-Drama", genres: ["Thriller", "Survival"], synopsis: "Cash-strapped players accept an invitation to deadly children's games with a life-changing prize." },
  { id: "reply88", title: "Reply 1988", altTitle: "응답하라 1988", score: 9.1, episodes: 20, year: 2015, type: "K-Drama", genres: ["Family", "Comedy"], synopsis: "Five childhood friends and their families share love and growing pains in a 1988 Seoul neighborhood." },
  { id: "hospital", title: "Hospital Playlist", altTitle: "슬기로운 의사생활", score: 8.9, episodes: 12, year: 2020, type: "K-Drama", genres: ["Medical", "Slice of Life"], synopsis: "Five doctor friends navigate careers, friendship, and band practice in the same hospital." },
  { id: "alchemy", title: "Alchemy of Souls", altTitle: "환혼", score: 8.5, episodes: 20, year: 2022, type: "K-Drama", genres: ["Fantasy", "Action"], synopsis: "Mages swap souls and fates collide in a fictional kingdom built on forbidden magic." },
];

/* ---------- curated C-drama catalog ---------- */
export const CDRAMAS = [
  { id: "untamed", title: "The Untamed", altTitle: "陈情令", score: 8.9, episodes: 50, year: 2019, type: "C-Drama", genres: ["Xianxia", "Action"], synopsis: "Two cultivators uncover the truth behind a massacre while confronting demons, ghosts, and each other." },
  { id: "lbfd", title: "Love Between Fairy and Devil", altTitle: "苍兰诀", score: 8.7, episodes: 40, year: 2022, type: "C-Drama", genres: ["Fantasy", "Romance"], synopsis: "An orchid fairy accidentally revives the devil lord of the Moon Tribe and binds their fates together." },
  { id: "ashes", title: "Ashes of Love", altTitle: "香蜜沉沉烬如霜", score: 8.0, episodes: 63, year: 2018, type: "C-Drama", genres: ["Xianxia", "Romance"], synopsis: "A flower deity's daughter falls for an ice prince while her adoptive brother schemes across the realms." },
  { id: "tmopb", title: "Eternal Love", altTitle: "三生三世十里桃花", score: 8.1, episodes: 58, year: 2017, type: "C-Drama", genres: ["Xianxia", "Romance"], synopsis: "The queen of Qingqiu endures three lifetimes of love and loss with the Heavenly Lord." },
  { id: "yanxi", title: "The Story of Yanxi Palace", altTitle: "延禧攻略", score: 8.7, episodes: 70, year: 2018, type: "C-Drama", genres: ["Palace", "Historical"], synopsis: "A clever embroidery maid climbs the ranks of the Qing palace by outwitting scheming consorts." },
  { id: "joy", title: "Joy of Life", altTitle: "庆余年", score: 8.5, episodes: 46, year: 2019, type: "C-Drama", genres: ["Historical", "Action"], synopsis: "A noble's son with modern memories survives court intrigue and martial arts politics." },
  { id: "nirvana", title: "Nirvana in Fire", altTitle: "琅琊榜", score: 9.1, episodes: 54, year: 2015, type: "C-Drama", genres: ["Historical", "Strategy"], synopsis: "A disgraced general's lone survivor returns as a brilliant strategist to topple the emperor who wronged him." },
  { id: "hidden", title: "Hidden Love", altTitle: "偷偷藏不住", score: 8.6, episodes: 25, year: 2023, type: "C-Drama", genres: ["Romance", "Youth"], synopsis: "A girl who crushed on her brother's friend since childhood finally gets her chance years later." },
  { id: "goahead", title: "Go Ahead", altTitle: "以家人之名", score: 8.7, episodes: 40, year: 2020, type: "C-Drama", genres: ["Family", "Youth"], synopsis: "Three non-blood siblings raised under one roof grow up and untangle what family and love mean." },
  { id: "wordofhonor", title: "Word of Honor", altTitle: "山河令", score: 8.7, episodes: 36, year: 2021, type: "C-Drama", genres: ["Wuxia", "Action"], synopsis: "A fake spy seeking freedom and a wandering sword master become unlikely sworn brothers in the jianghu." },
  { id: "loveo2o", title: "Love O2O", altTitle: "微微一笑很倾城", score: 8.1, episodes: 30, year: 2016, type: "C-Drama", genres: ["Romance", "Youth"], synopsis: "Campus legends of a popular online game fall in love through an in-game marriage before meeting offline." },
  { id: "meteor", title: "Meteor Garden", altTitle: "流星花园", score: 7.6, episodes: 49, year: 2018, type: "C-Drama", genres: ["Romance", "Youth"], synopsis: "An ordinary student stands up to the school's four richest heirs and changes all their lives." },
];

export const DRAMA_BY_KEY = new Map();
for (const d of KDRAMAS) DRAMA_BY_KEY.set(`kdrama:${d.id}`, { ...d, catalog: "kdrama", image: null, video: null });
for (const d of CDRAMAS) DRAMA_BY_KEY.set(`cdrama:${d.id}`, { ...d, catalog: "cdrama", image: null, video: null });

/* ---------- normalizers ---------- */
export function normAnime(raw) {
  const jap = (raw.titles || []).find((t) => t.type === "Japanese")?.title || raw.title_japanese || null;
  const eng = (raw.titles || []).find((t) => t.type === "English")?.title || raw.title_english || null;
  return {
    id: String(raw.mal_id), catalog: "anime",
    title: raw.title || eng || "Unknown title", altTitle: eng, jap,
    image: raw.images?.jpg?.large_image_url || raw.images?.jpg?.image_url || null,
    score: raw.score ?? null,
    genres: (raw.genres || []).map((g) => g.name).slice(0, 5),
    episodes: raw.episodes || raw.num_episodes || 12,
    year: raw.year ?? raw.aired?.prop?.from?.year ?? null,
    season: raw.season ?? null, type: raw.type ?? "TV",
    synopsis: raw.synopsis || "No synopsis available yet.",
    video: null,
  };
}

export function normMovie(r) {
  return {
    id: String(r.trackId), catalog: "movies",
    title: r.trackName || "Untitled", altTitle: r.artistName && r.artistName !== "Unknown" ? r.artistName : null,
    image: bigArt(r.artworkUrl100), score: null,
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    episodes: 1, year: (r.releaseDate || "").slice(0, 4) || null,
    type: "Movie", synopsis: r.longDescription || r.shortDescription || "No synopsis available yet.",
    video: r.previewUrl || null,
  };
}

export function normSeason(r) {
  return {
    id: String(r.collectionId), catalog: "series",
    title: r.artistName || r.collectionName || "Untitled", altTitle: r.collectionName || null,
    image: bigArt(r.artworkUrl100), score: null,
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    episodes: r.trackCount || 10, year: (r.releaseDate || "").slice(0, 4) || null,
    type: "TV Series", synopsis: r.longDescription || r.description || "No synopsis available yet.",
    video: r.previewUrl || null,
  };
}

/* ---------- caches ---------- */
export const detailCache = new Map();

export const epCache = new Map();

export const featuredCache = new Map();

export const knownItems = new Map();

export function remember(a) {
  if (a && a.id && a.catalog) knownItems.set(`${a.catalog}:${a.id}`, a);
  return a;
}

export const keyOf = (cat, id) => `${cat}:${id}`;

/* ---------- featured / browse fetchers ---------- */
export const MOVIE_TERMS = ["dune", "oppenheimer", "batman", "deadpool", "interstellar", "star wars", "godzilla", "barbie"];

export const SERIES_TERMS = ["breaking bad", "friends", "the office", "game of thrones", "stranger things", "suits", "peaky blinders", "the last of us"];

export async function featuredMovies() {
  const results = await Promise.all(MOVIE_TERMS.map((t) => itunes(`/search?term=${encodeURIComponent(t)}&limit=15&country=US`)));
  const seen = new Set();
  const out = [];
  for (const res of results) {
    if (!res || !Array.isArray(res.results)) continue;
    for (const r of res.results) {
      if (r.kind !== "feature-movie" || !r.artworkUrl100) continue;
      if (seen.has(r.trackId)) continue;
      seen.add(r.trackId);
      out.push(remember(normMovie(r)));
      if (out.length >= 24) return out;
    }
  }
  return out.length >= 6 ? out : MOVIE_FALLBACK.map(remember);
}

export async function featuredSeries() {
  const results = await Promise.all(SERIES_TERMS.map((t) => itunes(`/search?term=${encodeURIComponent(t)}&limit=15&country=US`)));
  const seen = new Set();
  const out = [];
  for (const res of results) {
    if (!res || !Array.isArray(res.results)) continue;
    for (const r of res.results) {
      if (r.collectionType !== "TV Season" || !r.artworkUrl100) continue;
      const k = String(r.artistName || "").toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(remember(normSeason(r)));
      if (out.length >= 24) return out;
    }
  }
  return out.length >= 6 ? out : SERIES_FALLBACK.map(remember);
}

export function getFeatured(cat) {
  if (cat !== "movies" && cat !== "series" && cat !== "free") return Promise.resolve([]);
  if (!featuredCache.has(cat)) {
    const p = cat === "movies" ? featuredMovies() : cat === "series" ? featuredSeries() : featuredFree();
    featuredCache.set(cat, p);
    p.catch(() => {});
  }
  return featuredCache.get(cat);
}

export function recentSeasons(n = 5) {
  const d = new Date();
  const names = ["winter", "spring", "summer", "fall"];
  const disp = ["Winter", "Spring", "Summer", "Fall"];
  let y = d.getFullYear();
  let idx = Math.floor(((d.getMonth() + 1) % 12) / 3);
  const out = [{ key: "now", label: "Now airing" }];
  for (let i = 0; i < n - 1; i++) {
    out.push({ key: `${y}-${names[idx]}`, label: `${disp[idx]} ${y}` });
    idx -= 1;
    if (idx < 0) { idx = 3; y -= 1; }
  }
  return out;
}

export async function fetchSeasonal(seasonKey) {
  const path = seasonKey === "now"
    ? "/seasons/now?limit=24&sfw=true"
    : `/seasons/${seasonKey}?limit=24&sfw=true`;
  const res = await api(path);
  if (!res || !Array.isArray(res.data)) return null;
  const items = res.data.map(normAnime).filter((a) => a.image).slice(0, 24);
  items.forEach(remember);
  return items.length ? items : MOCK_SEASON.map(remember);
}

/* ---------- search ---------- */
export async function searchCatalog(cat, q) {
  const query = q.trim();
  if (cat === "anime") {
    const res = await api(`/anime?q=${encodeURIComponent(query)}&limit=24&sfw=true`);
    if (!res || !Array.isArray(res.data)) {
      const needle = query.toLowerCase();
      return MOCK_SEASON.filter((a) => (a.altTitle || a.title).toLowerCase().includes(needle) || a.title.toLowerCase().includes(needle));
    }
    const items = res.data.map(normAnime).filter((a) => a.image);
    items.forEach(remember);
    return items;
  }
  if (cat === "movies" || cat === "series") {
    const res = await itunes(`/search?term=${encodeURIComponent(query)}&limit=40&country=US`);
    if (!res || !Array.isArray(res.results)) {
      const needle = query.toLowerCase();
      const pool = cat === "movies" ? MOVIE_FALLBACK : SERIES_FALLBACK;
      return pool.filter((a) => a.title.toLowerCase().includes(needle));
    }
    const seen = new Set();
    const out = [];
    for (const r of res.results) {
      if (cat === "movies" && r.kind === "feature-movie" && r.artworkUrl100) {
        if (seen.has(r.trackId)) continue;
        seen.add(r.trackId);
        out.push(remember(normMovie(r)));
      } else if (cat === "series" && r.collectionType === "TV Season" && r.artworkUrl100) {
        const k = String(r.artistName || "").toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(remember(normSeason(r)));
      }
      if (out.length >= 24) break;
    }
    return out;
  }
  if (cat === "free") {
    const safe = query.replace(/["()]/g, " ").trim();
    const q = `mediatype:movies AND collection:(feature_films OR Film_Noir OR SciFi_Horror OR moviesandfilms) AND title:(${safe})`;
    const res = await ia(`/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=24&page=1&output=json&sort%5B%5D=${encodeURIComponent("downloads desc")}`);
    const docs = res && res.response && Array.isArray(res.response.docs) ? res.response.docs : null;
    if (!docs || !docs.length) {
      const needle = query.toLowerCase();
      return FREE_FALLBACK.map(normIA).filter((x) => x.title.toLowerCase().includes(needle));
    }
    return docs.slice(0, 24).map(normIA).map(remember);
  }
  if (cat === "kdrama" || cat === "cdrama") {
    const needle = query.toLowerCase();
    const pool = cat === "kdrama" ? KDRAMAS : CDRAMAS;
    return pool
      .filter((d) => d.title.toLowerCase().includes(needle) || String(d.altTitle).toLowerCase().includes(needle))
      .map((d) => DRAMA_BY_KEY.get(`${cat}:${d.id}`));
  }
  return [];
}

/* ---------- detail & episodes ---------- */
export async function fetchDetail(cat, id) {
  const key = keyOf(cat, id);
  if (detailCache.has(key)) return detailCache.get(key);
  const known = knownItems.get(key);
  if (known) { detailCache.set(key, known); return known; }
  let a = null;
  if (cat === "anime") {
    const res = await api(`/anime/${id}/full`);
    if (res && res.data) a = normAnime(res.data);
    else a = MOCK_ANIME_BY_ID.get(String(id)) || null;
  } else if (cat === "movies" || cat === "series") {
    const res = await itunes(`/lookup?id=${id}&country=US`);
    const r = res && Array.isArray(res.results) && res.results[0];
    if (r && r.kind === "feature-movie") a = normMovie(r);
    else if (r && r.collectionType === "TV Season") a = normSeason(r);
    if (!a) a = knownItems.get(key) || null;
  } else if (cat === "free") {
    const res = await ia(`/metadata/${encodeURIComponent(id)}`);
    if (res && res.metadata && res.metadata.title) {
      const d = normIA({ identifier: id, title: res.metadata.title, year: res.metadata.year || String(res.metadata.date || "").slice(0, 4) });
      d.synopsis = stripHtml(res.metadata.description || "") || d.synopsis;
      a = d;
    }
    if (!a) a = knownItems.get(key) || null;
  } else if (cat === "kdrama" || cat === "cdrama") {
    a = DRAMA_BY_KEY.get(key) || knownItems.get(key) || null;
  }
  if (a) { detailCache.set(key, a); remember(a); }
  return a;
}

export async function fetchEpisodes(cat, id, item) {
  const key = keyOf(cat, id);
  if (epCache.has(key)) return epCache.get(key);
  let eps;
  if (cat === "anime") {
    const res = await api(`/anime/${id}/episodes`);
    if (res && Array.isArray(res.data) && res.data.length) {
      eps = res.data.map((e) => ({ num: e.mal_id, title: e.title || `Episode ${e.mal_id}` }));
    } else {
      eps = Array.from({ length: Math.min(item?.episodes || 12, 24) }, (_, i) => ({ num: i + 1, title: `Episode ${i + 1}` }));
    }
  } else if (cat === "movies") {
    eps = [{ num: 1, title: "Feature presentation" }];
  } else if (cat === "free") {
    eps = [{ num: 1, title: "Full movie" }];
  } else {
    eps = Array.from({ length: item?.episodes || 12 }, (_, i) => ({ num: i + 1, title: `Episode ${i + 1}` }));
  }
  epCache.set(key, eps);
  return eps;
}
