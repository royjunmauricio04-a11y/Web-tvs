import React, {useEffect, useState} from "react";
import { Search, X } from "lucide-react";
import { CATALOGS } from "../constants";
import { CatalogTabs, Grid, SkeletonGrid } from "../ui";
import { searchCatalog } from "../api";

/* ---------- Search ---------- */
export function SearchPage() {
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
