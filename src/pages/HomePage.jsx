import React, {useEffect, useMemo, useState} from "react";
import { Home } from "lucide-react";
import { CATALOGS } from "../constants";
import { useHistory } from "../storage";
import { CatalogTabs, ContinueRow, Hero, MediaRow } from "../ui";
import { CDRAMAS, DRAMA_BY_KEY, KDRAMAS, api, fetchSeasonal, getFeatured, normAnime, recentSeasons } from "../api";

/* ---------- Home ---------- */
export function HomePage() {
  const [cat, setCat] = useState("anime");
  const [seasonKey, setSeasonKey] = useState("now");
  const [list, setList] = useState(null);
  const [extra, setExtra] = useState(null);
  const hist = useHistory();
  const seasons = useMemo(() => recentSeasons(6), []);
  const isDrama = cat === "kdrama" || cat === "cdrama";

  useEffect(() => {
    let alive = true;
    setExtra(null);
    if (isDrama) {
      const all = (cat === "kdrama" ? KDRAMAS.map((d) => DRAMA_BY_KEY.get(`kdrama:${d.id}`)) : CDRAMAS.map((d) => DRAMA_BY_KEY.get(`cdrama:${d.id}`))).filter(Boolean);
      setList(all);
      setExtra({ title: "More picks for you", items: all.slice(6) });
      return;
    }
    setList(null);
    (async () => {
      let items = null;
      if (cat === "anime") items = await fetchSeasonal(seasonKey);
      else items = await getFeatured(cat);
      if (!alive) return;
      items = (items || []).filter(Boolean);
      setList(items);
      if (cat === "anime") {
        const top = await api("/top/anime?limit=10&sfw=true");
        if (alive && top && Array.isArray(top.data) && top.data.length) {
          setExtra({ title: "Top rated of all time", items: top.data.map(normAnime) });
        }
      } else if (items.length > 7) {
        setExtra({ title: "More to explore", items: items.slice(6) });
      }
    })();
    return () => { alive = false; };
  }, [cat, seasonKey, isDrama]);

  const meta = CATALOGS.find((c) => c.id === cat);
  const mainTitle =
    cat === "anime" ? `${seasons.find((s) => s.key === seasonKey)?.label || "Seasonal"} lineup`
      : cat === "movies" ? "Featured movies"
      : cat === "series" ? "Featured series"
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
      {extra && extra.items.length > 0 && <MediaRow title={extra.title} items={extra.items} loading={false} />}
    </div>
  );
}
