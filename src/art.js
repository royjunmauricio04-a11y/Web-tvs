import { CATALOGS } from "./constants";

/* ---------- SVG poster art ---------- */
export const PALETTES = [
  ["#7c3aed", "#1e1b4b"],
  ["#db2777", "#4c0d3f"],
  ["#0891b2", "#083344"],
  ["#f59e0b", "#451a03"],
  ["#10b981", "#022c22"],
  ["#6366f1", "#1e1b4b"],
  ["#e11d48", "#4c0519"],
  ["#0ea5e9", "#0c4a6e"],
];

export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function posterSvg(seed, title, tag) {
  const [c1, c2] = PALETTES[hashStr(seed) % PALETTES.length];
  let t = String(title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const words = t.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 16) {
      if (cur.trim()) lines.push(cur.trim());
      cur = w;
    } else cur = cur + " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const tspans = lines.slice(0, 4).map((l, i) => `<tspan x='150' y='${188 + i * 32}' text-anchor='middle'>${l}</tspan>`).join("");
  const tagLine = tag ? `<text x='150' y='396' text-anchor='middle' font-family='sans-serif' font-size='15' letter-spacing='4' fill='white' opacity='0.75'>${String(tag).toUpperCase()}</text>` : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='300' height='450' fill='url(#g)'/><circle cx='240' cy='70' r='90' fill='rgba(255,255,255,0.08)'/><circle cx='60' cy='380' r='70' fill='rgba(255,255,255,0.06)'/><circle cx='150' cy='118' r='44' fill='rgba(255,255,255,0.14)'/><path d='M136 96 L178 118 L136 140 Z' fill='white' opacity='0.9'/><text font-family='sans-serif' font-weight='700' font-size='25' fill='white' opacity='0.94'>${tspans}</text>${tagLine}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export function artFor(item) {
  return item.image || posterSvg(item.id, item.altTitle || item.title, CATALOGS.find((c) => c.id === item.catalog)?.label);
}
