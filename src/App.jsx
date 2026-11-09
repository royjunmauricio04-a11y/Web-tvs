import React, { useState, useEffect, useRef, useMemo, useContext, createContext, useCallback } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Home, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Star, Calendar, ChevronRight, ChevronLeft, X, RotateCcw, RotateCw, ArrowLeft, Bookmark, Clapperboard } from "lucide-react";

/* ============================================================
   TVS - multi-catalog viewer (web tribute to the DAVY app)
   Catalogs: Anime (Jikan), Movies & Series (iTunes Search API),
   Free Movies (Internet Archive, public domain full films),
   K-Drama & C-Drama (curated).
   Playback: official iTunes trailers, public domain films,
   and CC-licensed demo streams. No pirated content, ever.
   ============================================================ */

const JIKAN = "https://api.jikan.moe/v4";
const ITUNES = "https://itunes.apple.com";

const CATALOGS = [
  { id: "anime", label: "Anime", blurb: "Seasonal lineups from MyAnimeList" },
  { id: "movies", label: "Movies", blurb: "Feature films with official trailers" },
  { id: "series", label: "Series", blurb: "Popular TV series" },
  { id: "free", label: "Free Movies", blurb: "Full public domain films from the Internet Archive" },
  { id: "kdrama", label: "K-Drama", blurb: "Korean drama catalog" },
  { id: "cdrama", label: "C-Drama", blurb: "Chinese drama catalog" },
];

const DEMO_SOURCES = [
  { id: "alloha", label: "Alloha", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { id: "vidjoy", label: "VidJoy", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  { id: "yummy", label: "Yummy", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
  { id: "mirror", label: "Mirror", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" },
];

/* ---------- Internet Archive (public domain full movies) ---------- */
const IA = "https://archive.org";

async function ia(path) {
  try {
    const r = await fetch(IA + path);
    if (!r.ok) throw new Error("bad status " + r.status);
    return await r.json();
  } catch {
    return null;
  }
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normIA(doc) {
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

const FREE_FALLBACK = [
  { identifier: "his_girl_friday", title: "His Girl Friday", year: 1940, description: "A newspaper editor schemes to keep his ex-wife and star reporter on the story of a lifetime." },
  { identifier: "night_of_the_living_dead", title: "Night of the Living Dead", year: 1968, description: "Strangers barricade a farmhouse against the recently dead, risen by a passing radiation wave." },
  { identifier: "house_on_haunted_hill_ipod", title: "House on Haunted Hill", year: 1959, description: "A millionaire offers five guests a fortune to survive a night in a haunted mansion." },
  { identifier: "TheFastandtheFuriousJohnIreland1954goofyrip", title: "The Fast and the Furious", year: 1955, description: "A fugitive races a sports car across the country and picks up a woman along the way." },
  { identifier: "VoyagetothePlanetofPrehistoricWomen", title: "Voyage to the Planet of Prehistoric Women", year: 1967, description: "Cosmonauts explore Venus and awaken ancient dangers beneath its seas." },
  { identifier: "charlie_chaplin_film_fest", title: "Charlie Chaplin Festival", year: 1938, description: "A collection of classic Charlie Chaplin short comedies." },
];

async function featuredFree() {
  const q = "mediatype:movies AND collection:(feature_films OR Film_Noir OR SciFi_Horror OR moviesandfilms)";
  const res = await ia(`/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=48&page=1&output=json&sort%5B%5D=${encodeURIComponent("downloads desc")}`);
  const docs = res && res.response && Array.isArray(res.response.docs) ? res.response.docs : null;
  if (!docs || !docs.length) return FREE_FALLBACK.map(normIA);
  return docs.slice(0, 24).map(normIA).map(remember);
}

const iaVideoCache = new Map();
async function fetchIAVideo(id) {
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
async function api(path) {
  try {
    const r = await fetch(JIKAN + path);
    if (!r.ok) throw new Error("bad status " + r.status);
    return await r.json();
  } catch {
    return null;
  }
}

async function itunes(path) {
  try {
    const r = await fetch(ITUNES + path);
    if (!r.ok) throw new Error("bad status " + r.status);
    return await r.json();
  } catch {
    return null;
  }
}

function bigArt(url) {
  return url ? String(url).replace(/\/\d+x\d+bb\./, "/600x600bb.") : null;
}

/* Small thumbnail for cards: much faster to load than full-size art. */
function thumbFor(item) {
  const u = item.image;
  if (!u) return artFor(item);
  if (/\/600x600bb\./.test(u)) return u.replace("/600x600bb.", "/200x200bb.");
  if (/\/t\/p\/w500\//.test(u)) return u.replace("/w500/", "/w200/");
  if (/l\.jpg$/.test(u)) return u.replace(/l\.jpg$/, "t.jpg");
  return u;
}

/* ---------- SVG poster art ---------- */
const PALETTES = [
  ["#7c3aed", "#1e1b4b"],
  ["#db2777", "#4c0d3f"],
  ["#0891b2", "#083344"],
  ["#f59e0b", "#451a03"],
  ["#10b981", "#022c22"],
  ["#6366f1", "#1e1b4b"],
  ["#e11d48", "#4c0519"],
  ["#0ea5e9", "#0c4a6e"],
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}

function posterSvg(seed, title, tag) {
  const [c1, c2] = PALETTES[hashStr(seed) % PALETTES.length];
  let t = String(title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const words = t.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 16) {
      if (cur.trim()) lines.push(cur.trim());
      cur = w;
    } else cur = cur + " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const tspans = lines.slice(0, 4).map((l, i) => `<tspan x='150' y='${188 + i * 32}' text-anchor='middle'>${l}</tspan>`).join("");
  const tagLine = tag ? `<text x='150' y='396' text-anchor='middle' font-family='sans-serif' font-size='15' letter-spacing='4' fill='white' opacity='0.75'>${String(tag).toUpperCase()}</text>` : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='300' height='450' fill='url(#g)'/><circle cx='240' cy='70' r='90' fill='rgba(255,255,255,0.08)'/><circle cx='60' cy='380' r='70' fill='rgba(255,255,255,0.06)'/><circle cx='150' cy='118' r='44' fill='rgba(255,255,255,0.14)'/><path d='M136 96 L178 118 L136 140 Z' fill='white' opacity='0.9'/><text font-family='sans-serif' font-weight='700' font-size='25' fill='white' opacity='0.94'>${tspans}</text>${tagLine}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function artFor(item) {
  return item.image || posterSvg(item.id, item.altTitle || item.title, CATALOGS.find((c) => c.id === item.catalog)?.label);
}

/* ---------- anime fallback (offline) ---------- */
const MOCK_ANIME = [
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

function mockAnime(m) {
  return {
    id: m.id, catalog: "anime", title: m.title, altTitle: m.english, jap: m.japanese,
    image: posterSvg(m.id, m.english || m.title, "anime"),
    score: m.score, genres: m.genres, episodes: m.episodes || 24,
    year: m.year, season: m.season, type: m.type, synopsis: m.synopsis, video: null,
  };
}
const MOCK_SEASON = MOCK_ANIME.map(mockAnime);
const MOCK_ANIME_BY_ID = new Map(MOCK_ANIME.map((m) => [m.id, mockAnime(m)]));

/* ---------- movie & series fallback (offline) ---------- */
const MOVIE_FALLBACK = [
  { id: "f1", title: "Interstellar", altTitle: "Christopher Nolan", score: 8.7, episodes: 1, year: 2014, type: "Movie", genres: ["Sci-Fi", "Adventure"], synopsis: "Explorers push through a wormhole to find humanity a new home as Earth slowly dies." },
  { id: "f2", title: "Inception", altTitle: "Christopher Nolan", score: 8.8, episodes: 1, year: 2010, type: "Movie", genres: ["Sci-Fi", "Thriller"], synopsis: "A thief who steals secrets from dreams takes on one last job: planting an idea." },
  { id: "f3", title: "The Dark Knight", altTitle: "Christopher Nolan", score: 9.0, episodes: 1, year: 2008, type: "Movie", genres: ["Action", "Crime"], synopsis: "Batman faces the Joker, a criminal who wants to prove that everyone can be broken." },
  { id: "f4", title: "Parasite", altTitle: "Bong Joon-ho", score: 8.5, episodes: 1, year: 2019, type: "Movie", genres: ["Thriller", "Drama"], synopsis: "A poor family schemes its way into a wealthy household with escalating consequences." },
  { id: "f5", title: "Mad Max: Fury Road", altTitle: "George Miller", score: 8.6, episodes: 1, year: 2015, type: "Movie", genres: ["Action", "Adventure"], synopsis: "In a post-apocalyptic wasteland, two rebels flee a tyrant in a high-octance road war." },
  { id: "f6", title: "Everything Everywhere All at Once", altTitle: "Daniels", score: 8.7, episodes: 1, year: 2022, type: "Movie", genres: ["Sci-Fi", "Comedy"], synopsis: "A laundromat owner must connect with parallel-universe versions of herself to save the multiverse." },
  { id: "f7", title: "Spider-Man: Across the Spider-Verse", altTitle: "Joaquim Dos Santos", score: 8.6, episodes: 1, year: 2023, type: "Movie", genres: ["Animation", "Action"], synopsis: "Miles Morales leaps across dimensions and clashes with a whole society of Spider-People." },
  { id: "f8", title: "Oppenheimer", altTitle: "Christopher Nolan", score: 8.4, episodes: 1, year: 2023, type: "Movie", genres: ["Drama", "History"], synopsis: "The story of the physicist who led the race to build the atomic bomb." },
].map((m) => ({ ...m, catalog: "movies", image: null, synopsis: m.synopsis, video: null }));

const SERIES_FALLBACK = [
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
const KDRAMAS = [
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
const CDRAMAS = [
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

const DRAMA_BY_KEY = new Map();
for (const d of KDRAMAS) DRAMA_BY_KEY.set(`kdrama:${d.id}`, { ...d, catalog: "kdrama", image: null, video: null });
for (const d of CDRAMAS) DRAMA_BY_KEY.set(`cdrama:${d.id}`, { ...d, catalog: "cdrama", image: null, video: null });

/* ---------- normalizers ---------- */
function normAnime(raw) {
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

function normMovie(r) {
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

function normSeason(r) {
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
const detailCache = new Map();
const epCache = new Map();
const featuredCache = new Map();
const knownItems = new Map();
function remember(a) {
  if (a && a.id && a.catalog) knownItems.set(`${a.catalog}:${a.id}`, a);
  return a;
}
const keyOf = (cat, id) => `${cat}:${id}`;

/* ---------- featured / browse fetchers ---------- */
const MOVIE_TERMS = ["dune", "oppenheimer", "batman", "deadpool", "interstellar", "star wars", "godzilla", "barbie", "top gun", "john wick", "the matrix", "jurassic park", "avatar", "spider-man", "the lion king", "fast and furious", "mission impossible", "the conjuring", "harry potter", "lord of the rings"];
const SERIES_TERMS = ["breaking bad", "friends", "the office", "game of thrones", "stranger things", "suits", "peaky blinders", "the last of us", "wednesday", "money heist", "squid game", "the big bang theory", "modern family", "rick and morty", "the walking dead", "grey's anatomy", "criminal minds", "narcos", "better call saul", "yellowstone"];

async function featuredMovies() {
  const results = await Promise.all(MOVIE_TERMS.map((t) => itunes(`/search?term=${encodeURIComponent(t)}&limit=20&country=US`)));
  const seen = new Set();
  const out = [];
  for (const res of results) {
    if (!res || !Array.isArray(res.results)) continue;
    for (const r of res.results) {
      if (r.kind !== "feature-movie" || !r.artworkUrl100) continue;
      if (seen.has(r.trackId)) continue;
      seen.add(r.trackId);
      out.push(remember(normMovie(r)));
      if (out.length >= 30) return out;
    }
  }
  return out.length >= 6 ? out : MOVIE_FALLBACK.map(remember);
}

async function featuredSeries() {
  const results = await Promise.all(SERIES_TERMS.map((t) => itunes(`/search?term=${encodeURIComponent(t)}&limit=20&country=US`)));
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
      if (out.length >= 30) return out;
    }
  }
  return out.length >= 6 ? out : SERIES_FALLBACK.map(remember);
}

/* ---------- iTunes trending feeds (real top movies / TV seasons) ---------- */
function rssEntries(res) {
  return res && res.feed && Array.isArray(res.feed.entry) ? res.feed.entry : null;
}

function normRssMovie(e) {
  const idM = /id(\d+)/.exec(String(e?.id?.label || ""));
  const img = (e["im:image"] || []).slice(-1)[0]?.label || null;
  return {
    id: idM ? idM[1] : null, catalog: "movies",
    title: e["im:name"]?.label || "Untitled", altTitle: e["im:artist"]?.label || null,
    image: img ? bigArt(img) : null, score: null,
    genres: e.category?.attributes?.label ? [e.category.attributes.label] : [],
    episodes: 1, year: (e["im:releaseDate"]?.label || "").slice(0, 4) || null,
    type: "Movie", synopsis: stripHtml(e.summary?.label || "") || "A trending movie right now. Open it to watch the official trailer.",
    video: null,
  };
}

function normRssSeason(e) {
  const idM = /id(\d+)/.exec(String(e?.id?.label || ""));
  const img = (e["im:image"] || []).slice(-1)[0]?.label || null;
  return {
    id: idM ? idM[1] : null, catalog: "series",
    title: (e["im:artist"]?.label || e["im:name"]?.label || "Untitled").replace(/\s*,?\s*Season\s*\d+\s*$/i, ""),
    altTitle: e["im:name"]?.label || null,
    image: img ? bigArt(img) : null, score: null,
    genres: e.category?.attributes?.label ? [e.category.attributes.label] : [],
    episodes: 10, year: (e["im:releaseDate"]?.label || "").slice(0, 4) || null,
    type: "TV Series", synopsis: stripHtml(e.summary?.label || "") || "A trending series right now. Open it to browse episodes.",
    video: null,
  };
}

const trendCache = new Map();
async function trendingMovies() {
  if (!trendCache.has("movies")) {
    const p = (async () => {
      const res = await itunes("/us/rss/topmovies/limit=50/json");
      const items = (rssEntries(res) || []).map(normRssMovie).filter((x) => x.id && x.image).map(remember);
      return items.length >= 6 ? items : null;
    })();
    trendCache.set("movies", p);
    p.catch(() => {});
  }
  return trendCache.get("movies");
}

async function trendingSeasons() {
  if (!trendCache.has("series")) {
    const p = (async () => {
      const res = await itunes("/us/rss/toptvseasons/limit=50/json");
      const items = (rssEntries(res) || []).map(normRssSeason).filter((x) => x.id && x.image).map(remember);
      return items.length >= 6 ? items : null;
    })();
    trendCache.set("series", p);
    p.catch(() => {});
  }
  return trendCache.get("series");
}

/* ---------- TMDB (optional, free key set in Settings) ---------- */
async function tmdb(path) {
  const key = store.get("tvs-tmdb-key");
  if (!key) return null;
  try {
    const r = await fetch(`https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function normTmdb(r, kind) {
  const isMovie = kind === "movie";
  return {
    id: `tmdb-${r.id}`, catalog: isMovie ? "movies" : "series",
    title: r.title || r.name || "Untitled", altTitle: null,
    image: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
    backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
    score: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    genres: [], episodes: isMovie ? 1 : 10,
    year: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
    type: isMovie ? "Movie" : "TV Series",
    synopsis: r.overview || "No synopsis available yet.",
    video: null,
  };
}

const tmdbTrendCache = new Map();
async function tmdbTrending(cat) {
  if (!store.get("tvs-tmdb-key")) return null;
  if (tmdbTrendCache.has(cat)) return tmdbTrendCache.get(cat);
  const p = (async () => {
    const kind = cat === "movies" ? "movie" : "tv";
    const res = await tmdb(`/trending/${kind}/week`);
    const items = res && Array.isArray(res.results) ? res.results.map((r) => remember(normTmdb(r, kind))).filter((x) => x.image) : [];
    return items.length >= 6 ? items : null;
  })();
  tmdbTrendCache.set(cat, p);
  p.catch(() => {});
  return p;
}

function getFeatured(cat) {
  if (cat !== "movies" && cat !== "series" && cat !== "free") return Promise.resolve([]);
  if (!featuredCache.has(cat)) {
    const p = cat === "movies" ? featuredMovies() : cat === "series" ? featuredSeries() : featuredFree();
    featuredCache.set(cat, p);
    p.catch(() => {});
  }
  return featuredCache.get(cat);
}

function recentSeasons(n = 5) {
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

async function fetchSeasonal(seasonKey) {
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
async function searchCatalog(cat, q) {
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
async function fetchDetail(cat, id) {
  const key = keyOf(cat, id);
  if (detailCache.has(key)) return detailCache.get(key);
  const known = knownItems.get(key);
  if (known && known.video) { detailCache.set(key, known); return known; }
  let a = null;
  if (cat === "anime") {
    const res = await api(`/anime/${id}/full`);
    if (res && res.data) a = normAnime(res.data);
    else a = MOCK_ANIME_BY_ID.get(String(id)) || null;
  } else if (cat === "movies" || cat === "series") {
    if (/^tmdb-/.test(id)) {
      const kind = cat === "movies" ? "movie" : "tv";
      const num = id.slice(5);
      const d = await tmdb(`/${kind}/${num}`);
      if (d && (d.id || d.title || d.name)) {
        const it = normTmdb(d, kind);
        it.genres = (d.genres || []).map((g) => g.name).slice(0, 5);
        it.episodes = cat === "series" ? (d.number_of_episodes || 10) : 1;
        const s = await itunes(`/search?term=${encodeURIComponent(it.title)}&limit=5&country=US`);
        const m = s && Array.isArray(s.results) ? s.results.find((x) => (cat === "movies" ? x.kind === "feature-movie" : x.collectionType === "TV Season")) : null;
        if (m) {
          it.video = m.previewUrl || null;
          if (!it.image) it.image = bigArt(m.artworkUrl100);
        }
        a = it;
      }
      if (!a) a = knownItems.get(key) || null;
    } else {
      const res = await itunes(`/lookup?id=${id}&country=US`);
      const r = res && Array.isArray(res.results) && res.results[0];
      if (r && r.kind === "feature-movie") a = normMovie(r);
      else if (r && r.collectionType === "TV Season") a = normSeason(r);
      if (!a) a = knownItems.get(key) || null;
    }
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

async function fetchEpisodes(cat, id, item) {
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

/* ---------- watchlist ---------- */
const WatchlistCtx = createContext(null);
function useWatchlist() {
  return useContext(WatchlistCtx);
}

/* ---------- watch history (continue watching) ---------- */
function loadHistory() {
  try { return JSON.parse(store.get("tvs-history") || "[]"); } catch { return []; }
}
const HistoryCtx = createContext(null);
function useHistory() {
  return useContext(HistoryCtx);
}

const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* ---------- shared UI ---------- */
function fmtTime(t) {
  if (!isFinite(t) || t < 0) return "0:00";
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function ScoreBadge({ score }) {
  if (!score) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-amber-300 backdrop-blur">
      <Star className="h-3 w-3" /> {typeof score === "number" && score % 1 !== 0 ? score.toFixed(2) : score}
    </span>
  );
}

function MediaCard({ item }) {
  const wl = useWatchlist();
  const navigate = useNavigate();
  const img = thumbFor(item);
  const saved = wl.has(item.catalog, item.id);
  return (
    <div className="group relative cursor-pointer transition-transform duration-200 hover:-translate-y-1" onClick={() => navigate(`/m/${item.catalog}/${item.id}`)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-violet-500/60 group-hover:shadow-xl group-hover:shadow-violet-900/50">
        <img
          src={img}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = posterSvg(item.id, item.altTitle || item.title, item.catalog); }}
        />
        <div className="absolute left-2 top-2"><ScoreBadge score={item.score} /></div>
        <button
          onClick={(e) => { e.stopPropagation(); wl.toggle(item.catalog, item.id); }}
          className={`absolute right-2 top-2 rounded-full p-1.5 backdrop-blur transition-colors ${saved ? "bg-violet-500 text-white" : "bg-black/60 text-slate-300 hover:text-white"}`}
          title={saved ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Bookmark className="h-4 w-4" />
        </button>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-t from-violet-950/70 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="rounded-full bg-violet-600 p-3.5 text-white shadow-lg ring-1 ring-white/20">
            <Play className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Watch now</span>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium text-slate-100 group-hover:text-violet-300">{item.title}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {item.type}
          {item.episodes && item.episodes > 1 ? ` · ${item.episodes} eps` : ""}
          {item.year ? ` · ${item.year}` : ""}
        </p>
      </div>
    </div>
  );
}

function Grid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((a) => <MediaCard key={`${a.catalog}-${a.id}`} item={a} />)}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-xl bg-slate-800/80" />
          <div className="mt-2 h-3 w-4/5 rounded bg-slate-800/80" />
          <div className="mt-1.5 h-2.5 w-2/5 rounded bg-slate-800/60" />
        </div>
      ))}
    </div>
  );
}

/* ---------- horizontal media row ---------- */
function MediaRow({ title, items, loading }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    if (ref.current) ref.current.scrollBy({ left: dir * Math.max(320, ref.current.clientWidth * 0.8), behavior: "smooth" });
  };
  if (loading) {
    return (
      <section className="mb-8">
        <div className="mb-3 h-6 w-44 animate-pulse rounded bg-slate-800/80" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-[150px] shrink-0 sm:w-[170px]">
              <div className="aspect-[2/3] animate-pulse rounded-xl bg-slate-800/80" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!items || items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="flex gap-1.5">
          <button onClick={() => scroll(-1)} className="rounded-full bg-slate-800/80 p-1.5 text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-slate-700 hover:text-white" title="Scroll left">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} className="rounded-full bg-slate-800/80 p-1.5 text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-slate-700 hover:text-white" title="Scroll right">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={ref} className="tvs-scroll flex gap-4 overflow-x-auto pb-2">
        {items.map((a) => (
          <div key={`${a.catalog}-${a.id}`} className="w-[150px] shrink-0 sm:w-[170px]">
            <MediaCard item={a} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- continue watching row ---------- */
function ContinueRow({ entries }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const list = entries || [];

  useEffect(() => {
    let alive = true;
    if (list.length === 0) { setRows([]); return; }
    (async () => {
      const found = await Promise.all(list.slice(0, 10).map(async (h) => {
        const key = keyOf(h.cat, h.id);
        let it = knownItems.get(key) || detailCache.get(key);
        if (!it) it = await fetchDetail(h.cat, h.id);
        return it ? { h, it } : null;
      }));
      if (alive) setRows(found.filter(Boolean));
    })();
    return () => { alive = false; };
  }, [entries]);

  if (!rows || rows.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/25 text-violet-300">
          <Play className="h-3 w-3" />
        </span>
        Continue watching
      </h2>
      <div className="tvs-scroll flex gap-4 overflow-x-auto pb-2">
        {rows.map(({ h, it }) => {
          const img = thumbFor(it);
          const pct = h.dur > 0 ? Math.min(100, Math.round((h.t / h.dur) * 100)) : 0;
          return (
            <button
              key={`${h.cat}-${h.id}`}
              onClick={() => navigate(`/watch/${h.cat}/${h.id}/${h.ep}`)}
              className="group w-[240px] shrink-0 text-left sm:w-[260px]"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 transition-all group-hover:ring-violet-500/60">
                <img
                  src={img}
                  alt={it.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.src = posterSvg(h.id, it.altTitle || it.title, h.cat); }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-violet-200 backdrop-blur">
                  {it.episodes > 1 ? `EP ${h.ep}` : it.type}
                </span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-violet-600 p-3 text-white shadow-lg">
                    <Play className="h-5 w-5" />
                  </span>
                </span>
                <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-100 group-hover:text-violet-300">{it.title}</p>
              <p className="text-xs text-slate-400">
                {it.episodes > 1 ? `Episode ${h.ep}` : it.type} · resume at {fmtTime(h.t)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- hero carousel ---------- */
function Hero({ items, loading }) {
  const navigate = useNavigate();
  const wl = useWatchlist();
  const [i, setI] = useState(0);
  const slides = (items || []).filter(Boolean).slice(0, 3);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (loading) {
    return <div className="mb-6 aspect-video w-full animate-pulse rounded-3xl bg-slate-800/60 ring-1 ring-white/5" />;
  }
  if (slides.length === 0) return null;
  const it = slides[i % slides.length];
  const img = it.backdrop || artFor(it);
  const saved = wl.has(it.catalog, it.id);
  const isMovie = it.catalog === "movies";
  const cta = it.catalog === "free" ? "Watch full movie" : isMovie ? "Watch trailer" : "Watch Episode 1";
  const label = CATALOGS.find((c) => c.id === it.catalog)?.label || "";

  return (
    <div className="relative mb-6 h-[360px] overflow-hidden rounded-3xl ring-1 ring-white/10 sm:h-[420px] md:h-[460px]">
      <AnimatePresence>
        <motion.div
          key={`${it.catalog}-${it.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <img
            src={img}
            alt={it.title}
            className="h-full w-full scale-110 object-cover blur-[1px]"
            onError={(e) => { e.currentTarget.style.opacity = "0"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
            <div className="max-w-2xl">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-violet-400">Featured · {label}</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl">{it.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ScoreBadge score={it.score} />
                <Chip>{it.type}</Chip>
                {it.year && <Chip>{it.year}</Chip>}
                {it.episodes > 1 && <Chip>{it.episodes} eps</Chip>}
                {(it.genres || []).slice(0, 2).map((g) => (
                  <span key={g} className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-500/30">{g}</span>
                ))}
              </div>
              <p className="mt-3 line-clamp-2 max-w-xl text-sm text-slate-300 sm:text-base">{it.synopsis}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate(`/watch/${it.catalog}/${it.id}/1`)}
                  className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500"
                >
                  <Play className="h-4 w-4" /> {cta}
                </button>
                <button
                  onClick={() => navigate(`/m/${it.catalog}/${it.id}`)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
                >
                  More info
                </button>
                <button
                  onClick={() => wl.toggle(it.catalog, it.id)}
                  className={`rounded-full p-3 ring-1 backdrop-blur transition ${saved ? "bg-violet-500 text-white ring-violet-400/50" : "bg-black/40 text-slate-200 ring-white/20 hover:text-white"}`}
                  title={saved ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <Bookmark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      {slides.length > 1 && (
        <div className="absolute right-6 top-6 z-10 flex gap-1.5">
          {slides.map((s, idx) => (
            <button
              key={`${s.catalog}-${s.id}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i % slides.length ? "w-7 bg-violet-500" : "w-2.5 bg-white/30 hover:bg-white/60"}`}
              title={`Featured ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfflineNote({ show }) {
  if (!show) return null;
  return (
    <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
      Live data is unreachable right now, showing the built-in sample catalog instead.
    </p>
  );
}

function CatalogTabs({ value, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {CATALOGS.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${value === c.id ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Home ---------- */
function HomePage() {
  const [cat, setCat] = useState("anime");
  const [seasonKey, setSeasonKey] = useState("now");
  const [list, setList] = useState(null);
  const [rows, setRows] = useState([]);
  const hist = useHistory();
  const seasons = useMemo(() => recentSeasons(6), []);
  const isDrama = cat === "kdrama" || cat === "cdrama";

  useEffect(() => {
    let alive = true;
    setRows([]);
    if (isDrama) {
      const all = (cat === "kdrama" ? KDRAMAS.map((d) => DRAMA_BY_KEY.get(`kdrama:${d.id}`)) : CDRAMAS.map((d) => DRAMA_BY_KEY.get(`cdrama:${d.id}`))).filter(Boolean);
      setList(all);
      setRows(all.length > 6 ? [{ title: "More picks for you", items: all.slice(6) }] : []);
      return;
    }
    setList(null);
    (async () => {
      if (cat === "anime") {
        const main = ((await fetchSeasonal(seasonKey)) || []).filter(Boolean);
        if (!alive) return;
        setList(main);
        const [top, airing] = await Promise.all([
          api("/top/anime?limit=10&sfw=true"),
          api("/top/anime?filter=airing&limit=10&sfw=true"),
        ]);
        if (!alive) return;
        const extra = [];
        if (top && Array.isArray(top.data) && top.data.length) extra.push({ title: "Top rated of all time", items: top.data.map(normAnime) });
        if (airing && Array.isArray(airing.data) && airing.data.length) extra.push({ title: "Airing now", items: airing.data.map(normAnime) });
        setRows(extra);
        return;
      }
      if (cat === "movies" || cat === "series") {
        const [tr, feat, tmdbRow] = await Promise.all([cat === "movies" ? trendingMovies() : trendingSeasons(), getFeatured(cat), tmdbTrending(cat)]);
        if (!alive) return;
        const trendItems = (tr || []).filter(Boolean);
        const all = (feat || []).filter(Boolean);
        const trendIds = new Set(trendItems.map((x) => String(x.id)));
        const fresh = all.filter((x) => !trendIds.has(String(x.id)));
        setList(trendItems.length ? trendItems : all);
        const extra = [];
        if (tmdbRow && tmdbRow.length) {
          extra.push({ title: "Trending this week (TMDB)", items: tmdbRow.slice(0, 20) });
        }
        if (trendItems.length && fresh.length) {
          extra.push({ title: cat === "movies" ? "Featured movies" : "Featured series", items: fresh.slice(0, 15) });
        }
        if (fresh.length > 15) {
          extra.push({ title: "More to explore", items: fresh.slice(15) });
        }
        setRows(extra);
        return;
      }
      const main = ((await getFeatured(cat)) || []).filter(Boolean);
      if (!alive) return;
      setList(main);
      setRows(main.length > 24 ? [{ title: "More free movies", items: main.slice(24) }] : []);
    })();
    return () => { alive = false; };
  }, [cat, seasonKey, isDrama]);

  const meta = CATALOGS.find((c) => c.id === cat);
  const mainTitle =
    cat === "anime" ? `${seasons.find((s) => s.key === seasonKey)?.label || "Seasonal"} lineup`
      : cat === "movies" ? "Top movies right now"
      : cat === "series" ? "Trending series"
      : cat === "free" ? "Public domain full movies"
      : cat === "kdrama" ? "Korean dramas"
      : "Chinese dramas";

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Browse</h1>
        <p className="mt-1 text-sm text-slate-400">{meta?.blurb}</p>
      </div>
      <CatalogTabs value={cat} onChange={setCat} />

      {!isDrama && <Hero items={list === null ? [] : list.slice(0, 3)} loading={list === null} />}

      <ContinueRow entries={hist.list} />

      {cat === "anime" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {seasons.map((s) => (
            <button
              key={s.key}
              onClick={() => setSeasonKey(s.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${seasonKey === s.key ? "bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/50" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <MediaRow title={mainTitle} items={list || []} loading={list === null} />
      {rows.map((r) => (
        <MediaRow key={r.title} title={r.title} items={r.items} loading={false} />
      ))}
    </div>
  );
}

/* ---------- Search ---------- */
function SearchPage() {
  const [cat, setCat] = useState("anime");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const items = await searchCatalog(cat, q);
      if (alive) setResults(items);
    }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [q, cat]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Search</h1>
      <div className="mt-4">
        <CatalogTabs value={cat} onChange={(c) => { setCat(c); setResults(null); }} />
      </div>
      <div className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title..."
          className="w-full rounded-full border border-white/10 bg-slate-800/80 py-3 pl-11 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {q.trim() === "" ? (
        <p className="text-sm text-slate-400">Type a title to search the {CATALOGS.find((c) => c.id === cat)?.label} catalog.</p>
      ) : results === null ? (
        <SkeletonGrid />
      ) : results.length === 0 ? (
        <p className="text-sm text-slate-400">No results for "{q}".</p>
      ) : (
        <Grid items={results} />
      )}
    </div>
  );
}

/* ---------- Detail ---------- */
function Chip({ children }) {
  return <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{children}</span>;
}

function DetailPage() {
  const { cat, id } = useParams();
  const navigate = useNavigate();
  const wl = useWatchlist();
  const hist = useHistory();
  const [item, setItem] = useState(null);
  const [eps, setEps] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setItem(null); setEps(null); setMissing(false);
    (async () => {
      const a = await fetchDetail(cat, id);
      if (!alive) return;
      if (!a) { setMissing(true); return; }
      setItem(a);
      const list = await fetchEpisodes(cat, id, a);
      if (alive) setEps(list);
    })();
    return () => { alive = false; };
  }, [cat, id]);

  if (missing) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-sm text-slate-400">This title could not be loaded. It may have been removed from the catalog.</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="animate-pulse">
        <div className="h-64 w-full rounded-2xl bg-slate-800/70" />
        <div className="mt-4 h-6 w-1/3 rounded bg-slate-800/70" />
        <div className="mt-3 h-3 w-3/4 rounded bg-slate-800/50" />
      </div>
    );
  }

  const saved = wl.has(item.catalog, item.id);
  const img = artFor(item);
  const isMovie = item.catalog === "movies";
  const cta = item.catalog === "free" ? "Watch full movie" : isMovie ? "Watch trailer" : "Watch Episode 1";

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
        <div className="absolute inset-0">
          <img src={item.backdrop || img} alt="" className="h-full w-full scale-110 object-cover blur-2xl opacity-30" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
        </div>
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row">
          <img
            src={img}
            alt={item.title}
            className="aspect-[2/3] w-44 shrink-0 self-start rounded-xl object-cover shadow-xl ring-1 ring-white/10 sm:w-52"
            onError={(e) => { e.currentTarget.src = posterSvg(item.id, item.altTitle || item.title, item.catalog); }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{item.title}</h1>
            {item.altTitle && item.altTitle !== item.title && <p className="mt-1 text-sm text-slate-400">{item.altTitle}</p>}
            {item.jap && <p className="text-sm text-slate-500">{item.jap}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ScoreBadge score={item.score} />
              <Chip>{item.type}</Chip>
              {item.year && <Chip>{item.year}</Chip>}
              {item.season && <span className="capitalize"><Chip>{item.season}</Chip></span>}
              {item.episodes > 1 && <Chip>{item.episodes} episodes</Chip>}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">{item.synopsis}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.genres.map((g) => (
                <span key={g} className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300">{g}</span>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/watch/${item.catalog}/${item.id}/1`)}
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-colors hover:bg-violet-500"
              >
                <Play className="h-4 w-4" /> {cta}
              </button>
              {(() => {
                const h = hist.get(item.catalog, item.id);
                if (!h || !h.t || h.t < 5) return null;
                return (
                  <button
                    onClick={() => navigate(`/watch/${item.catalog}/${item.id}/${h.ep}`)}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-500/25"
                  >
                    <Play className="h-4 w-4" /> {item.episodes > 1 ? `Continue Episode ${h.ep}` : "Continue watching"} · {fmtTime(h.t)}
                  </button>
                );
              })()}
              <button
                onClick={() => wl.toggle(item.catalog, item.id)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 transition-colors ${saved ? "bg-violet-500/20 text-violet-200 ring-violet-500/50" : "bg-slate-800/70 text-slate-200 ring-white/10 hover:bg-slate-700"}`}
              >
                <Bookmark className="h-4 w-4" /> {saved ? "In watchlist" : "Add to watchlist"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {eps && eps.length > 1 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold text-white">Episodes</h2>
          <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {eps.map((e) => (
              <button
                key={e.num}
                onClick={() => navigate(`/watch/${item.catalog}/${item.id}/${e.num}`)}
                title={e.title}
                className="rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/5 transition-colors hover:bg-violet-600 hover:text-white"
              >
                {e.num}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Player ---------- */
function Player({ src, poster, title, epLabel, hasNext, onNext, resumeAt, onTime }) {
  const vref = useRef(null);
  const wrapRef = useRef(null);
  const hideTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [vidErr, setVidErr] = useState(false);
  const [controls, setControls] = useState(true);
  const [fs, setFs] = useState(false);
  const [rate, setRate] = useState(1);
  const RATES = [1, 1.25, 1.5, 2, 0.75];

  const poke = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (vref.current && !vref.current.paused) setControls(false);
    }, 2800);
  }, []);

  useEffect(() => {
    poke();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [poke, playing]);

  useEffect(() => {
    const v = vref.current;
    if (v) { v.volume = vol; v.muted = muted; }
  }, [vol, muted]);

  useEffect(() => {
    const v = vref.current;
    if (v) v.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = vref.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }, []);

  const skip = useCallback((delta) => {
    const v = vref.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.1, v.currentTime + delta));
    setCur(v.currentTime);
    poke();
  }, [poke]);

  const toggleFs = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (wrapRef.current) wrapRef.current.requestFullscreen().catch(() => {});
    } catch { /* sandbox may block fullscreen */ }
  }, []);

  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === " ") e.preventDefault();
        return;
      }
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "ArrowUp": e.preventDefault(); setVol((x) => Math.min(1, Math.round((x + 0.1) * 10) / 10)); break;
        case "ArrowDown": e.preventDefault(); setVol((x) => Math.max(0, Math.round((x - 0.1) * 10) / 10)); break;
        case "m": setMuted((m) => !m); break;
        case "f": toggleFs(); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [togglePlay, skip, toggleFs]);

  const onLoaded = () => {
    const v = vref.current;
    if (!v) return;
    setDur(v.duration || 0);
    if (resumeAt && resumeAt > 2 && resumeAt < (v.duration || 0) - 2) v.currentTime = resumeAt;
    v.playbackRate = rate;
    v.play().catch(() => { setBusy(false); setControls(true); /* autoplay blocked: user presses play */ });
    poke();
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={poke}
      onTouchStart={poke}
      className={`group relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 ${controls ? "" : "cursor-none"}`}
    >
      <video
        ref={vref}
        src={src}
        poster={poster}
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
        onLoadedMetadata={onLoaded}
        onError={() => { setBusy(false); setVidErr(true); }}
        onTimeUpdate={(e) => { setCur(e.currentTarget.currentTime); if (onTime) onTime(e.currentTarget.currentTime, e.currentTarget.duration || 0); }}
        onPlay={() => { setPlaying(true); setEnded(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBusy(true)}
        onPlaying={() => setBusy(false)}
        onCanPlay={() => setBusy(false)}
        onEnded={() => { setPlaying(false); setEnded(true); setControls(true); }}
        onClick={togglePlay}
      />

      {busy && !ended && !vidErr && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-violet-500" />
        </div>
      )}

      {vidErr && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
          <p className="text-sm font-semibold text-white">Stream failed to load</p>
          <p className="text-xs text-slate-400">Try a different server below, or check your connection.</p>
        </div>
      )}

      {controls && !playing && !busy && !ended && !vidErr && (
        <button onClick={togglePlay} className="absolute inset-x-0 bottom-24 top-0 flex items-center justify-center" title="Play">
          <span className="rounded-full bg-violet-600/90 p-5 text-white shadow-xl ring-1 ring-white/20 backdrop-blur">
            <Play className="h-8 w-8" />
          </span>
        </button>
      )}

      <AnimatePresence>
        {controls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="pointer-events-auto">
                <p className="text-sm font-semibold text-white drop-shadow sm:text-base">{title}</p>
                <p className="text-xs text-slate-300">{epLabel}</p>
              </div>
              <span className="pointer-events-auto rounded bg-black/50 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-300 ring-1 ring-white/10">HD · SUB/DUB</span>
            </div>

            <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-10">
              <input
                type="range"
                min={0}
                max={dur || 0}
                step={0.1}
                value={Math.min(cur, dur || 0)}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  const v = vref.current;
                  if (v) v.currentTime = t;
                  setCur(t);
                }}
                className="tvs-range mb-2 w-full"
              />
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={togglePlay} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title={playing ? "Pause (k)" : "Play (k)"}>
                  {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                <button onClick={() => skip(-10)} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Back 10s">
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button onClick={() => skip(10)} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Forward 10s">
                  <RotateCw className="h-5 w-5" />
                </button>
                <div className="group/vol flex items-center gap-2">
                  <button onClick={() => setMuted((m) => !m)} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Mute (m)">
                    {muted || vol === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : vol}
                    onChange={(e) => { setVol(Number(e.target.value)); setMuted(Number(e.target.value) === 0); }}
                    className="tvs-range w-0 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100"
                  />
                </div>
                <span className="ml-1 text-xs font-medium tabular-nums text-slate-300">
                  {fmtTime(cur)} / {fmtTime(dur)}
                </span>
                <button
                  onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"
                  title="Playback speed"
                >
                  {rate}x
                </button>
                <div className="flex-1" />
                {hasNext && (
                  <button onClick={onNext} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Next episode">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
                <button onClick={toggleFs} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Fullscreen (f)">
                  {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ended && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          <p className="text-sm text-slate-300">Playback finished</p>
          <div className="flex gap-3">
            <button
              onClick={() => { const v = vref.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); setEnded(false); } }}
              className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-slate-700"
            >
              <Play className="h-4 w-4" /> Replay
            </button>
            {hasNext && (
              <button
                onClick={onNext}
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Next episode <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Watch page ---------- */
function WatchPage() {
  const { cat, id, ep } = useParams();
  const navigate = useNavigate();
  const epNum = Number(ep) || 1;
  const [item, setItem] = useState(null);
  const [eps, setEps] = useState(null);
  const [srcId, setSrcId] = useState(null);
  const [dub, setDub] = useState("SUB");
  const [iaVideo, setIaVideo] = useState(undefined);
  const [missing, setMissing] = useState(false);
  const timeRef = useRef(0);
  const lastSave = useRef(0);
  const [resumeAt, setResumeAt] = useState(0);
  const hist = useHistory();

  useEffect(() => {
    lastSave.current = 0;
    const prior = loadHistory().find((e) => e.cat === cat && e.id === id);
    setResumeAt(prior && Number(prior.ep) === epNum ? prior.t || 0 : 0);
  }, [cat, id, epNum]);

  useEffect(() => {
    let alive = true;
    setItem(null); setEps(null); setResumeAt(0); timeRef.current = 0; setSrcId(null); setIaVideo(undefined); setMissing(false);
    (async () => {
      const free = cat === "free";
      const [a, url] = await Promise.all([
        fetchDetail(cat, id),
        free ? fetchIAVideo(id) : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (!a) { setMissing(true); return; }
      setItem(a);
      setIaVideo(free ? url : null);
      setSrcId(free ? (url ? "archive" : DEMO_SOURCES[0].id) : a.video ? "trailer" : DEMO_SOURCES[0].id);
      const list = await fetchEpisodes(cat, id, a);
      if (alive) setEps(list);
    })();
    return () => { alive = false; };
  }, [cat, id]);

  const histRef = useRef(hist);
  histRef.current = hist;
  useEffect(() => {
    return () => {
      const t = timeRef.current;
      if (t > 5) histRef.current.save(cat, id, epNum, t, 0);
    };
  }, [cat, id, epNum]);

  if (missing) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-sm text-slate-400">This title could not be loaded. It may have been removed from the catalog.</p>
      </div>
    );
  }

  if (!item || !eps || (cat === "free" && iaVideo === undefined)) {
    return (
      <div className="animate-pulse">
        <div className="aspect-video w-full rounded-2xl bg-slate-800/70" />
        <div className="mt-4 h-5 w-1/3 rounded bg-slate-800/70" />
      </div>
    );
  }

  const archiveSources = iaVideo ? [{ id: "archive", label: "Internet Archive", url: iaVideo }] : [];
  const sources = item.video
    ? [{ id: "trailer", label: "Trailer (official)", url: item.video }, ...archiveSources, ...DEMO_SOURCES]
    : [...archiveSources, ...DEMO_SOURCES];
  const source = sources.find((s) => s.id === srcId) || sources[0];
  const curEp = eps.find((e) => e.num === epNum) || { num: epNum, title: `Episode ${epNum}` };
  const hasNext = epNum < eps.length;
  const single = eps.length === 1;
  const img = artFor(item);

  return (
    <div className={single ? "" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"}>
      <div>
        <Player
          key={`${item.catalog}-${item.id}-${epNum}-${source.id}`}
          src={source.url}
          poster={img}
          title={item.title}
          epLabel={`${curEp.title || `Episode ${curEp.num}`} · ${dub}`}
          hasNext={hasNext}
          onNext={() => { timeRef.current = 0; setResumeAt(0); navigate(`/watch/${item.catalog}/${item.id}/${epNum + 1}`); }}
          resumeAt={resumeAt}
          onTime={(t, d) => {
            timeRef.current = t;
            if (t - lastSave.current > 5 || t < lastSave.current) {
              lastSave.current = t;
              hist.save(cat, id, epNum, t, d);
            }
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["SUB", "DUB"].map((d) => (
            <button
              key={d}
              onClick={() => setDub(d)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${dub === d ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {d}
            </button>
          ))}
          <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">Servers</span>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => { setResumeAt(timeRef.current); setSrcId(s.id); }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${source.id === s.id ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              title={`Switch stream to ${s.label}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <h1 className="text-lg font-bold text-white">{item.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{curEp.title || `Episode ${curEp.num}`}</p>
          <p className="mt-2 line-clamp-3 max-w-3xl text-sm text-slate-400">{item.synopsis}</p>
          {cat === "free" ? (
            <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              Streaming the full movie from the Internet Archive: public domain, free, and legal.
            </p>
          ) : !item.video && (
            <p className="mt-3 rounded-lg border border-white/10 bg-slate-800/40 px-3 py-2 text-xs text-slate-500">
              Note: playback in this demo uses open-licensed sample streams. Metadata, posters, and episode lists are real.
            </p>
          )}
        </div>
      </div>

      {!single && (
        <aside>
          <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Episodes</h2>
              <span className="text-xs text-slate-500">{eps.length} total</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto p-2">
              {eps.map((e) => (
                <button
                  key={e.num}
                  onClick={() => { timeRef.current = 0; setResumeAt(0); navigate(`/watch/${item.catalog}/${item.id}/${e.num}`); }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${e.num === epNum ? "bg-violet-600/20 ring-1 ring-violet-500/40" : "hover:bg-slate-800"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${e.num === epNum ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                    {e.num}
                  </span>
                  <span className={`line-clamp-2 text-xs ${e.num === epNum ? "text-white" : "text-slate-400"}`}>
                    {e.title || `Episode ${e.num}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

/* ---------- Watchlist page ---------- */
function WatchlistPage() {
  const wl = useWatchlist();
  const items = Array.from(wl.keys()).map((k) => knownItems.get(k)).filter(Boolean);
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Watchlist</h1>
      <p className="mt-1 text-sm text-slate-400">Titles you bookmarked while browsing.</p>
      <div className="mt-6">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing saved yet. Tap the bookmark icon on any poster to add it here.</p>
        ) : (
          <Grid items={items} />
        )}
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
function NavItem({ to, icon, label, badge }) {
  const loc = useLocation();
  const active = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-violet-600/20 text-violet-200 ring-1 ring-violet-500/40" : "text-slate-400 hover:bg-slate-800/70 hover:text-white"}`}
    >
      {icon}
      {label ? <span>{label}</span> : null}
      {badge ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}

function Shell() {
  const loc = useLocation();
  const [wlKeys, setWlKeys] = useState(() => {
    try { return new Set(JSON.parse(store.get("tvs-watchlist") || "[]")); } catch { return new Set(); }
  });
  const [hist, setHist] = useState(loadHistory);
  const [toasts, setToasts] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [tmdbKeyInput, setTmdbKeyInput] = useState(() => store.get("tvs-tmdb-key") || "");
  const toastId = useRef(0);

  const pushToast = useCallback((msg) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  const wl = useMemo(() => ({
    keys: wlKeys,
    has: (cat, id) => wlKeys.has(keyOf(cat, id)),
    toggle: (cat, id) => {
      const k = keyOf(cat, id);
      const had = wlKeys.has(k);
      const next = new Set(wlKeys);
      if (had) next.delete(k); else next.add(k);
      store.set("tvs-watchlist", JSON.stringify(Array.from(next)));
      setWlKeys(next);
      pushToast(had ? "Removed from your watchlist" : "Added to your watchlist");
    },
  }), [wlKeys, pushToast]);

  const histApi = useMemo(() => ({
    list: hist,
    get: (cat, id) => hist.find((e) => e.cat === cat && e.id === id) || null,
    save: (cat, id, ep, t, dur) => {
      setHist((prev) => {
        const old = prev.find((e) => e.cat === cat && e.id === id);
        const d = dur > 0 ? dur : (old ? old.dur : 0);
        let next = prev.filter((e) => !(e.cat === cat && e.id === id));
        const finished = d > 0 && t >= d - 5;
        if (!finished && t > 5) next = [{ cat, id, ep, t, dur: d, at: Date.now() }, ...next];
        next = next.slice(0, 12);
        store.set("tvs-history", JSON.stringify(next));
        return next;
      });
    },
    clear: () => { store.set("tvs-history", "[]"); setHist([]); },
  }), [hist]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <WatchlistCtx.Provider value={wl}>
      <HistoryCtx.Provider value={histApi}>
        <style>{`
          .tvs-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 9999px; background: rgba(255,255,255,0.25); outline: none; cursor: pointer; }
          .tvs-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 9999px; background: #8b5cf6; box-shadow: 0 0 6px rgba(139,92,246,0.7); }
          .tvs-range::-moz-range-thumb { width: 14px; height: 14px; border: none; border-radius: 9999px; background: #8b5cf6; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 9999px; }
          ::-webkit-scrollbar-track { background: transparent; }
          .line-clamp-2, .line-clamp-3 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
          .line-clamp-2 { -webkit-line-clamp: 2; }
          .line-clamp-3 { -webkit-line-clamp: 3; }
          .tvs-scroll { scrollbar-width: none; -ms-overflow-style: none; }
          .tvs-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
              <Link to="/" className="flex shrink-0 items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-900/50">
                  <Clapperboard className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-lg font-extrabold leading-none tracking-tight text-white">TVS</span>
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-400">Anime · Movies · Drama</span>
                </span>
              </Link>
              <nav className="ml-4 hidden items-center gap-1 md:flex">
                <NavItem to="/" icon={<Home className="h-4 w-4" />} label="Home" />
                <NavItem to="/search" icon={<Search className="h-4 w-4" />} label="Search" />
                <NavItem to="/watchlist" icon={<Bookmark className="h-4 w-4" />} label="Watchlist" badge={wlKeys.size || null} />
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25 lg:inline">100% legal streams</span>
                <button
                  onClick={() => pushToast("Tip: Space = play/pause, arrows = seek, F = fullscreen")}
                  className="hidden rounded-full bg-slate-800/80 p-2 text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white md:block"
                  title="Player tips"
                >
                  <Clapperboard className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="rounded-full bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white"
                  title="Settings"
                >
                  Settings
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 sm:px-6 md:pb-12">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Routes location={loc}>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/m/:cat/:id" element={<DetailPage />} />
                <Route path="/watch/:cat/:id/:ep" element={<WatchPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </motion.div>

            <footer className="mt-10 border-t border-white/5 pt-6">
              <p className="max-w-4xl text-xs leading-relaxed text-slate-500">
                TVS · multi-catalog viewer. Data: Jikan (MyAnimeList), iTunes Search API, and the Internet Archive. Drama catalogs are curated samples. Demo streams: Blender open movies (CC). Legal playback only, for personal use.
              </p>
            </footer>
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/10 bg-slate-950/95 py-2 backdrop-blur md:hidden">
            <NavItem to="/" icon={<Home className="h-5 w-5" />} label="" />
            <NavItem to="/search" icon={<Search className="h-5 w-5" />} label="" />
            <NavItem to="/watchlist" icon={<Bookmark className="h-5 w-5" />} label="" badge={wlKeys.size || null} />
          </nav>

          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowSettings(false)}>
              <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <label className="mt-4 block text-sm font-semibold text-slate-300">TMDB API key (free, optional)</label>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Create a free account at themoviedb.org, open Settings there and copy your API Key (v3). This unlocks the weekly trending rows with real backdrops and posters.
                </p>
                <input
                  value={tmdbKeyInput}
                  onChange={(e) => setTmdbKeyInput(e.target.value)}
                  placeholder="Paste your TMDB API key"
                  className="mt-3 w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-violet-500/60"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      store.set("tvs-tmdb-key", tmdbKeyInput.trim());
                      pushToast(tmdbKeyInput.trim() ? "TMDB key saved, reloading" : "TMDB key cleared, reloading");
                      setTimeout(() => window.location.reload(), 900);
                    }}
                    className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-500"
                  >
                    Save key
                  </button>
                  <button
                    onClick={() => { store.set("tvs-tmdb-key", ""); setTmdbKeyInput(""); pushToast("TMDB key removed, reloading"); setTimeout(() => window.location.reload(), 900); }}
                    className="rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-slate-700"
                  >
                    Remove key
                  </button>
                </div>
                <div className="mt-6 border-t border-white/5 pt-4">
                  <button
                    onClick={() => { histApi.clear(); pushToast("Watch history cleared"); }}
                    className="text-sm font-semibold text-rose-300 transition-colors hover:text-rose-200"
                  >
                    Clear watch history
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 md:bottom-6">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl bg-slate-900/95 px-4 py-2.5 text-sm font-medium text-white shadow-xl ring-1 ring-white/10 backdrop-blur"
                >
                  {t.msg}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </HistoryCtx.Provider>
    </WatchlistCtx.Provider>
  );
}

export default function App() {
  return <BrowserRouter><Shell /></BrowserRouter>;
}
