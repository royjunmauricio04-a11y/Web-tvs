import React, {useEffect, useRef, useState} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DEMO_SOURCES } from "../constants";
import { artFor } from "../art";
import { loadHistory, useHistory } from "../storage";
import { Player } from "../Player";
import { fetchDetail, fetchEpisodes, fetchIAVideo } from "../api";

/* ---------- Watch page ---------- */
export function WatchPage() {
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
