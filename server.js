/* TVS server: zero dependencies. Serves ./dist (SPA fallback), gzip, cache headers,
   security headers, and a caching proxy for Jikan / iTunes / Internet Archive APIs. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm",
  ".txt": "text/plain",
};
const COMPRESSIBLE = /\.(html|js|mjs|css|json|svg|webmanifest|txt)$/i;

const UPSTREAMS = {
  jikan: { base: "https://api.jikan.moe/v4", ttl: 10 * 60_000, gap: 400 }, // Jikan: ~3 req/s limit
  itunes: { base: "https://itunes.apple.com", ttl: 30 * 60_000, gap: 0 },
  ia: { base: "https://archive.org", ttl: 60 * 60_000, gap: 0 },
};
const cache = new Map(); // key -> { t, status, body }
const inflight = new Map();
const lastCall = {};
const MAX_CACHE = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchUpstream(name, rest) {
  const up = UPSTREAMS[name];
  const key = name + rest;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < up.ttl) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    try {
      if (up.gap) { // simple spacing so we never burst past the upstream rate limit
        const wait = Math.max(0, (lastCall[name] || 0) + up.gap - Date.now());
        lastCall[name] = Date.now() + wait;
        if (wait) await sleep(wait);
      }
      let r = await fetch(up.base + rest, { headers: { "User-Agent": "TVS/1.5" }, signal: AbortSignal.timeout(15000) });
      if (r.status === 429 && up.gap) { await sleep(1200); r = await fetch(up.base + rest, { signal: AbortSignal.timeout(15000) }); }
      const body = Buffer.from(await r.arrayBuffer());
      const out = { t: Date.now(), status: r.status, body };
      if (r.ok) {
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(key, out);
      } else if (hit) return hit; // serve stale on upstream error
      return out;
    } catch {
      if (hit) return hit;
      return { t: Date.now(), status: 502, body: Buffer.from('{"error":"upstream unavailable"}') };
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, job);
  return job;
}

function baseHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
  };
}

function send(req, res, status, headers, data, compress) {
  const h = { ...baseHeaders(), ...headers };
  if (compress && /\bgzip\b/.test(req.headers["accept-encoding"] || "") && data.length > 1024) {
    data = zlib.gzipSync(data);
    h["Content-Encoding"] = "gzip";
    h["Vary"] = "Accept-Encoding";
  }
  h["Content-Length"] = data.length;
  res.writeHead(status, h);
  res.end(data);
}


/* ---------- accounts (zero-dependency) ----------
   Storage: Supabase Postgres when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (persistent),
   otherwise a local JSON file under DATA_DIR (dev only; ephemeral on Render's free plan). */
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SB = Boolean(SB_URL && SB_KEY);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "users.json");
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_TTL = 30 * 24 * 3600 * 1000;

async function sb(method, query, body, extra = {}) {
  const headers = { apikey: SB_KEY, "Content-Type": "application/json", ...extra };
  if (SB_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SB_KEY}`; // legacy JWT keys only
  return fetch(`${SB_URL}/rest/v1/profiles${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
}

let fileUsers = {};
if (!USE_SB) { try { fileUsers = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { fileUsers = {}; } }
let saveTimer = null;
function saveFile() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE + ".tmp", JSON.stringify(fileUsers));
      fs.renameSync(DB_FILE + ".tmp", DB_FILE);
    } catch (e) { console.error("save failed", e.message); }
  }, 500);
}

const db = {
  async get(name) {
    if (!USE_SB) return fileUsers[name] || null;
    const r = await sb("GET", `?username=eq.${encodeURIComponent(name)}&select=*&limit=1`);
    if (!r.ok) throw new Error("db get " + r.status);
    return (await r.json())[0] || null;
  },
  async create(name, rec) { // returns false if the username already exists
    if (!USE_SB) { if (fileUsers[name]) return false; fileUsers[name] = rec; saveFile(); return true; }
    const r = await sb("POST", "", { username: name, ...rec }, { Prefer: "return=minimal" });
    if (r.status === 409) return false;
    if (!r.ok) throw new Error("db create " + r.status);
    return true;
  },
  async update(name, patch) {
    if (!USE_SB) { Object.assign(fileUsers[name], patch); saveFile(); return; }
    const r = await sb("PATCH", `?username=eq.${encodeURIComponent(name)}`, patch, { Prefer: "return=minimal" });
    if (!r.ok) throw new Error("db update " + r.status);
  },
};
console.log(`Accounts storage: ${USE_SB ? "Supabase" : "local JSON file (not persistent on Render free)"}`);
const b64 = (b) => Buffer.from(b).toString("base64url");
function sign(username) {
  const body = b64(JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL }));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return body + "." + sig;
}
function verify(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p.u : null;
  } catch { return null; }
}
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString("hex"); }
const attempts = new Map(); // ip -> { n, t }
function tooMany(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.t > 15 * 60_000) { attempts.set(ip, { n: 1, t: Date.now() }); return false; }
  return ++a.n > 20;
}
function readBody(req, limit = 200_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}
const jsonRes = (req, res, status, obj) =>
  send(req, res, status, { "Content-Type": "application/json", "Cache-Control": "no-store" }, Buffer.from(JSON.stringify(obj)), false);
const cleanList = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

async function handleAuth(req, res, url) {
  const ip = req.socket.remoteAddress || "?";
  try {
    if (url.pathname === "/api/auth/register" || url.pathname === "/api/auth/login") {
      if (req.method !== "POST") return jsonRes(req, res, 405, { error: "POST only" });
      if (tooMany(ip)) return jsonRes(req, res, 429, { error: "Too many attempts. Try again later." });
      let b; try { b = await readBody(req, 5000); } catch { return jsonRes(req, res, 400, { error: "Bad request" }); }
      const name = String(b.username || "").trim().toLowerCase();
      const pw = String(b.password || "");
      if (!/^[a-z0-9_]{3,20}$/.test(name)) return jsonRes(req, res, 400, { error: "Username: 3-20 letters, numbers or _" });
      if (pw.length < 8 || pw.length > 200) return jsonRes(req, res, 400, { error: "Password must be at least 8 characters" });
      if (url.pathname.endsWith("register")) {
        const salt = crypto.randomBytes(16).toString("hex");
        const ok = await db.create(name, { salt, hash: hashPw(pw, salt), watchlist: [], history: [] });
        if (!ok) return jsonRes(req, res, 409, { error: "Username already taken" });
      } else {
        const u = await db.get(name);
        const good = u && crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt)), Buffer.from(u.hash));
        if (!good) return jsonRes(req, res, 401, { error: "Wrong username or password" });
      }
      return jsonRes(req, res, 200, { token: sign(name), username: name });
    }
    if (url.pathname === "/api/me/sync") {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
      const name = m && verify(m[1]);
      const u = name && (await db.get(name));
      if (!u) return jsonRes(req, res, 401, { error: "Not signed in" });
      if (req.method === "GET") return jsonRes(req, res, 200, { username: name, watchlist: u.watchlist || [], history: u.history || [] });
      if (req.method === "PUT") {
        let b; try { b = await readBody(req); } catch { return jsonRes(req, res, 400, { error: "Bad request" }); }
        await db.update(name, {
          watchlist: cleanList(b.watchlist, 2000).filter((x) => typeof x === "string").map((x) => x.slice(0, 200)),
          history: cleanList(b.history, 50).filter((e) => e && typeof e === "object").map((e) => ({
            cat: String(e.cat || "").slice(0, 20), id: String(e.id ?? "").slice(0, 200), ep: e.ep,
            t: Number(e.t) || 0, dur: Number(e.dur) || 0, at: Number(e.at) || Date.now(),
          })),
        });
        return jsonRes(req, res, 200, { ok: true });
      }
      return jsonRes(req, res, 405, { error: "Method not allowed" });
    }
    return jsonRes(req, res, 404, { error: "Not found" });
  } catch (e) {
    console.error("auth error:", e.message);
    return jsonRes(req, res, 503, { error: "Account service is temporarily unavailable" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://x");
    if (url.pathname.startsWith("/api/auth/") || url.pathname === "/api/me/sync") return await handleAuth(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(req, res, 405, {}, Buffer.from("Method not allowed"), false);
    if (url.pathname === "/healthz") return send(req, res, 200, { "Content-Type": "text/plain" }, Buffer.from("ok"), false);

    const m = url.pathname.match(/^\/api\/(jikan|itunes|ia)(\/.*)?$/);
    if (m) {
      const out = await fetchUpstream(m[1], (m[2] || "") + url.search);
      return send(req, res, out.status, {
        "Content-Type": "application/json",
        "Cache-Control": out.status === 200 ? "public, max-age=300" : "no-store",
      }, out.body, true);
    }

    let urlPath = decodeURIComponent(url.pathname);
    if (urlPath === "/") urlPath = "/index.html";
    let file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) return send(req, res, 403, {}, Buffer.from("Forbidden"), false);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
    const data = await fs.promises.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const hashed = file.includes(`${path.sep}assets${path.sep}`);
    send(req, res, 200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
    }, data, COMPRESSIBLE.test(file));
  } catch {
    send(req, res, 404, { "Content-Type": "text/plain" }, Buffer.from("Not found. Run `npm run build` first."), false);
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`TVS running on port ${PORT} (serving ./dist)`));

// Optional: keep Render's free plan awake by pinging our own public URL (set KEEP_ALIVE=true).
if (process.env.KEEP_ALIVE === "true" && process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => fetch(process.env.RENDER_EXTERNAL_URL + "/healthz").catch(() => {}), 10 * 60_000);
}
