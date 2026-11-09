import React, {useCallback, useEffect, useRef, useState} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, ChevronRight, RotateCcw, RotateCw, ArrowLeft } from "lucide-react";
import { fmtTime } from "./ui";

/* ---------- Player ---------- */
export function Player({ src, poster, title, epLabel, hasNext, onNext, resumeAt, onTime }) {
  const vref = useRef(null);
  const wrapRef = useRef(null);
  const hideTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [vidErr, setVidErr] = useState(false);
  const [controls, setControls] = useState(true);
  const [fs, setFs] = useState(false);
  const [rate, setRate] = useState(1);
  const RATES = [1, 1.25, 1.5, 2, 0.75];

  const poke = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (vref.current && !vref.current.paused) setControls(false);
    }, 2800);
  }, []);

  useEffect(() => {
    poke();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [poke, playing]);

  useEffect(() => {
    const v = vref.current;
    if (v) { v.volume = vol; v.muted = muted; }
  }, [vol, muted]);

  useEffect(() => {
    const v = vref.current;
    if (v) v.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = vref.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }, []);

  const skip = useCallback((delta) => {
    const v = vref.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.1, v.currentTime + delta));
    setCur(v.currentTime);
    poke();
  }, [poke]);

  const toggleFs = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (wrapRef.current) wrapRef.current.requestFullscreen().catch(() => {});
    } catch { /* sandbox may block fullscreen */ }
  }, []);

  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === " ") e.preventDefault();
        return;
      }
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "ArrowUp": e.preventDefault(); setVol((x) => Math.min(1, Math.round((x + 0.1) * 10) / 10)); break;
        case "ArrowDown": e.preventDefault(); setVol((x) => Math.max(0, Math.round((x - 0.1) * 10) / 10)); break;
        case "m": setMuted((m) => !m); break;
        case "f": toggleFs(); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [togglePlay, skip, toggleFs]);

  const onLoaded = () => {
    const v = vref.current;
    if (!v) return;
    setDur(v.duration || 0);
    if (resumeAt && resumeAt > 2 && resumeAt < (v.duration || 0) - 2) v.currentTime = resumeAt;
    v.playbackRate = rate;
    v.play().catch(() => { setBusy(false); setControls(true); /* autoplay blocked: user presses play */ });
    poke();
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={poke}
      onTouchStart={poke}
      className={`group relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 ${controls ? "" : "cursor-none"}`}
    >
      <video
        ref={vref}
        src={src}
        poster={poster}
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
        onLoadedMetadata={onLoaded}
        onError={() => { setBusy(false); setVidErr(true); }}
        onTimeUpdate={(e) => { setCur(e.currentTarget.currentTime); if (onTime) onTime(e.currentTarget.currentTime, e.currentTarget.duration || 0); }}
        onPlay={() => { setPlaying(true); setEnded(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBusy(true)}
        onPlaying={() => setBusy(false)}
        onCanPlay={() => setBusy(false)}
        onEnded={() => { setPlaying(false); setEnded(true); setControls(true); }}
        onClick={togglePlay}
      />

      {busy && !ended && !vidErr && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-violet-500" />
        </div>
      )}

      {vidErr && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
          <p className="text-sm font-semibold text-white">Stream failed to load</p>
          <p className="text-xs text-slate-400">Try a different server below, or check your connection.</p>
        </div>
      )}

      {controls && !playing && !busy && !ended && !vidErr && (
        <button onClick={togglePlay} className="absolute inset-x-0 bottom-24 top-0 flex items-center justify-center" title="Play">
          <span className="rounded-full bg-violet-600/90 p-5 text-white shadow-xl ring-1 ring-white/20 backdrop-blur">
            <Play className="h-8 w-8" />
          </span>
        </button>
      )}

      <AnimatePresence>
        {controls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="pointer-events-auto">
                <p className="text-sm font-semibold text-white drop-shadow sm:text-base">{title}</p>
                <p className="text-xs text-slate-300">{epLabel}</p>
              </div>
              <span className="pointer-events-auto rounded bg-black/50 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-300 ring-1 ring-white/10">HD · SUB/DUB</span>
            </div>

            <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-10">
              <input
                type="range"
                min={0}
                max={dur || 0}
                step={0.1}
                value={Math.min(cur, dur || 0)}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  const v = vref.current;
                  if (v) v.currentTime = t;
                  setCur(t);
                }}
                className="tvs-range mb-2 w-full"
              />
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={togglePlay} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title={playing ? "Pause (k)" : "Play (k)"}>
                  {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>
                <button onClick={() => skip(-10)} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Back 10s">
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button onClick={() => skip(10)} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Forward 10s">
                  <RotateCw className="h-5 w-5" />
                </button>
                <div className="group/vol flex items-center gap-2">
                  <button onClick={() => setMuted((m) => !m)} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Mute (m)">
                    {muted || vol === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : vol}
                    onChange={(e) => { setVol(Number(e.target.value)); setMuted(Number(e.target.value) === 0); }}
                    className="tvs-range w-0 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100"
                  />
                </div>
                <span className="ml-1 text-xs font-medium tabular-nums text-slate-300">
                  {fmtTime(cur)} / {fmtTime(dur)}
                </span>
                <button
                  onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"
                  title="Playback speed"
                >
                  {rate}x
                </button>
                <div className="flex-1" />
                {hasNext && (
                  <button onClick={onNext} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Next episode">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
                <button onClick={toggleFs} className="rounded-full p-2 text-white transition-colors hover:bg-white/10" title="Fullscreen (f)">
                  {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ended && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          <p className="text-sm text-slate-300">Playback finished</p>
          <div className="flex gap-3">
            <button
              onClick={() => { const v = vref.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); setEnded(false); } }}
              className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-slate-700"
            >
              <Play className="h-4 w-4" /> Replay
            </button>
            {hasNext && (
              <button
                onClick={onNext}
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Next episode <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
