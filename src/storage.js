import { useContext, createContext } from "react";

/* ---------- watchlist ---------- */
export const WatchlistCtx = createContext(null);

export function useWatchlist() {
  return useContext(WatchlistCtx);
}

/* ---------- watch history (continue watching) ---------- */
export function loadHistory() {
  try { return JSON.parse(store.get("tvs-history") || "[]"); } catch { return []; }
}

export const HistoryCtx = createContext(null);

export function useHistory() {
  return useContext(HistoryCtx);
}

export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* ---------- accounts ---------- */
export const AuthCtx = createContext({ user: null, login: async () => "Unavailable", logout: () => {} });
export function useAuth() {
  return useContext(AuthCtx);
}
