import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Home, Bookmark, Clapperboard, LogIn, LogOut } from "lucide-react";
import { AuthCtx, HistoryCtx, WatchlistCtx, loadHistory, store } from "./storage";
import { authRequest, syncGet, syncPut } from "./auth";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { DetailPage } from "./pages/DetailPage";
import { WatchPage } from "./pages/WatchPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { keyOf } from "./api";

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
  const toastId = useRef(0);
  const [user, setUser] = useState(() => store.get("tvs-user"));
  const synced = useRef(false);

  const pushToast = useCallback((msg) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  const logout = useCallback(() => {
    store.set("tvs-token", "");
    store.set("tvs-user", "");
    synced.current = false;
    setUser(null);
    pushToast("Signed out");
  }, [pushToast]);

  const login = useCallback(async (mode, username, password) => {
    const { status, data } = await authRequest(mode, username, password);
    if (status !== 200 || !data.token) return data.error || "Something went wrong";
    store.set("tvs-token", data.token);
    store.set("tvs-user", data.username);
    setUser(data.username);
    pushToast(`Signed in as ${data.username}`);
    return null;
  }, [pushToast]);

  // On sign-in (or app load while signed in): merge the server copy with this device, then keep it synced.
  useEffect(() => {
    if (!user) return;
    let dead = false;
    (async () => {
      const { status, data } = await syncGet();
      if (dead) return;
      if (status === 401) { logout(); return; }
      if (status !== 200) return;
      setWlKeys((prev) => {
        const next = new Set([...prev, ...(data.watchlist || [])]);
        store.set("tvs-watchlist", JSON.stringify(Array.from(next)));
        return next;
      });
      setHist((prev) => {
        const map = new Map();
        for (const e of [...(data.history || []), ...prev]) {
          const k = keyOf(e.cat, e.id);
          const o = map.get(k);
          if (!o || (e.at || 0) > (o.at || 0)) map.set(k, e);
        }
        const next = Array.from(map.values()).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12);
        store.set("tvs-history", JSON.stringify(next));
        return next;
      });
      synced.current = true;
    })();
    return () => { dead = true; };
  }, [user, logout]);

  useEffect(() => {
    if (!user || !synced.current) return;
    const t = setTimeout(() => { syncPut({ watchlist: Array.from(wlKeys), history: hist }); }, 1200);
    return () => clearTimeout(t);
  }, [wlKeys, hist, user]);

  const auth = useMemo(() => ({ user, login, logout }), [user, login, logout]);

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
  }), [hist]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <AuthCtx.Provider value={auth}>
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
                {user ? (
                  <button onClick={logout} title="Sign out" className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10 hover:text-white">
                    @{user} <LogOut className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Link to="/login" className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                    <LogIn className="h-3.5 w-3.5" /> Sign in
                  </Link>
                )}
                <button
                  onClick={() => pushToast("Tip: Space = play/pause, arrows = seek, F = fullscreen")}
                  className="hidden rounded-full bg-slate-800/80 p-2 text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white md:block"
                  title="Player tips"
                >
                  <Clapperboard className="h-4 w-4" />
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
                <Route path="/login" element={<AuthPage />} />
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
    </AuthCtx.Provider>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-sm text-slate-400">The page hit an unexpected error. Reloading usually fixes it.</p>
        <button onClick={() => window.location.assign("/")} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold hover:bg-violet-500">
          Back to home
        </button>
      </div>
    );
  }
}


export default function App() {
  return <ErrorBoundary><BrowserRouter><Shell /></BrowserRouter></ErrorBoundary>;
}
