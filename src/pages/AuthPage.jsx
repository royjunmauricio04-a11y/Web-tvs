import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../storage";

export function AuthPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const error = await login(mode, username, password);
    setBusy(false);
    if (error) setErr(error);
    else nav("/");
  }

  const input = "w-full rounded-xl bg-slate-900 px-4 py-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-violet-500";
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <LogIn className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-400">Sync your watchlist and watch history across devices.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className={input} type="password" placeholder="Password (8+ characters)" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        {err ? <p className="text-sm text-rose-400">{err}</p> : null}
        <button disabled={busy} className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold transition-colors hover:bg-violet-500 disabled:opacity-60">
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }} className="mt-4 w-full text-center text-sm text-slate-400 hover:text-white">
        {mode === "login" ? "No account yet? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
