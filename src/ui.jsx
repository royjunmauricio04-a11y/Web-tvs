import React, {useEffect, useRef, useState} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Star, ChevronRight, ChevronLeft, Bookmark } from "lucide-react";
import { CATALOGS } from "./constants";
import { artFor, posterSvg } from "./art";
import { useWatchlist } from "./storage";
import { detailCache, fetchDetail, keyOf, knownItems } from "./api";

/* ---------- shared UI ---------- */
export function fmtTime(t) {
  if (!isFinite(t) || t < 0) return "0:00";
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ScoreBadge({ score }) {
  if (!score) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-amber-300 backdrop-blur">
      <Star className="h-3 w-3" /> {typeof score === "number" && score % 1 !== 0 ? score.toFixed(2) : score}
    </span>
  );
}

export function MediaCard({ item }) {
  const wl = useWatchlist();
  const navigate = useNavigate();
  const img = artFor(item);
  const saved = wl.has(item.catalog, item.id);
  return (
    <div className="group relative cursor-pointer transition-transform duration-200 hover:-translate-y-1" onClick={() => navigate(`/m/${item.catalog}/${item.id}`)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-violet-500/60 group-hover:shadow-xl group-hover:shadow-violet-900/50">
        <img
          src={img}
          alt={item.title}
          loading="lazy"
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

export function Grid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((a) => <MediaCard key={`${a.catalog}-${a.id}`} item={a} />)}
    </div>
  );
}

export function SkeletonGrid() {
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
export function MediaRow({ title, items, loading }) {
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
export function ContinueRow({ entries }) {
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
          const img = artFor(it);
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
export function Hero({ items, loading }) {
  const navigate = useNavigate();
  const wl = useWatchlist();
  const [i, setI] = useState(0);
  const slides = (items || []).filter(Boolean).slice(0, 3);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (loading || slides.length === 0) {
    return <div className="mb-6 aspect-video w-full animate-pulse rounded-3xl bg-slate-800/60 ring-1 ring-white/5" />;
  }
  const it = slides[i % slides.length];
  const img = artFor(it);
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

export function OfflineNote({ show }) {
  if (!show) return null;
  return (
    <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
      Live data is unreachable right now, showing the built-in sample catalog instead.
    </p>
  );
}

export function CatalogTabs({ value, onChange }) {
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

/* ---------- Detail ---------- */
export function Chip({ children }) {
  return <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{children}</span>;
}
