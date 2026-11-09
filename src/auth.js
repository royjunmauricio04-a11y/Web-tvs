import { store } from "./storage";

export const getToken = () => store.get("tvs-token");

async function call(path, opts) {
  try {
    const r = await fetch(path, opts);
    if (!(r.headers.get("content-type") || "").includes("json")) {
      return { status: r.status, data: { error: "Account server unavailable. Run the Node server (npm start)." } };
    }
    return { status: r.status, data: await r.json() };
  } catch {
    return { status: 0, data: { error: "Can't reach the server. Check your connection." } };
  }
}

export async function authRequest(mode, username, password) {
  return call(`/api/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

const authHeaders = () => ({ Authorization: `Bearer ${getToken() || ""}`, "Content-Type": "application/json" });

export const syncGet = () => call("/api/me/sync", { headers: authHeaders() });
export const syncPut = (body) => call("/api/me/sync", { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
