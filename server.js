/* TVS static server: serves the built app (dist/) with SPA routing.
   Usage:
     npm run build
     npm run serve            (http://localhost:8080)
     PORT=3000 npm run serve  (custom port)
   No dependencies: plain Node.js http server. */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".mp4": "video/mp4",
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const filePath = normalize(join(DIST, urlPath));
    if (!filePath.startsWith(normalize(DIST))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let data;
    let servedPath = filePath;
    try {
      data = await readFile(filePath);
    } catch {
      // SPA fallback: unknown routes go to index.html so React Router can handle them
      servedPath = join(DIST, "index.html");
      data = await readFile(servedPath);
    }
    const type = MIME[extname(servedPath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found. Did you run `npm run build` first?");
  }
});

server.listen(PORT, () => {
  console.log(`TVS server running at http://localhost:${PORT}`);
  console.log("Serving ./dist (run `npm run build` first). Press Ctrl+C to stop.");
});
