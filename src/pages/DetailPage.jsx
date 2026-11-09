import React, {useEffect, useState} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, ArrowLeft, Bookmark } from "lucide-react";
import { artFor, posterSvg } from "../art";
import { useHistory, useWatchlist } from "../storage";
import { Chip, ScoreBadge, fmtTime } from "../ui";
import { fetchDetail, fetchEpisodes } from "../api";

export function DetailPage() {
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
          <img src={img} alt="" className="h-full w-full scale-110 object-cover blur-2xl opacity-30" onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
