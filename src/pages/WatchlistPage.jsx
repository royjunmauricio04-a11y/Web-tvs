import React from "react";
import { useWatchlist } from "../storage";
import { Grid } from "../ui";
import { knownItems } from "../api";

/* ---------- Watchlist page ---------- */
export function WatchlistPage() {
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
