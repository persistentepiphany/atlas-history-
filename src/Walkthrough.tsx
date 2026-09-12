import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Stop { at: number; label: string; prompt: string }
export interface Segment { id: string; kind: 'title' | 'page' | 'photo' | 'colour' | 'reactor' | 'return' | 'end'; seconds: number; audio?: string; text: string; archive?: string; archiveText?: string; archiveSpeaker?: string; prompt?: string; stops?: Stop[] }
export interface WalkthroughSpec { id: string; title: string; date: string; page: string; photo: { x: number; y: number; w: number; h: number }; seed: string | null; segments: Segment[] }

interface Cue { text: string; start: number; end: number }
const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/** Sentences spread across a window by length, never shorter than a second, never longer than six. */
export function cuesFor(text: string, start: number, seconds: number): Cue[] {
  const parts = text.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
  const total = parts.reduce((n, p) => n + p.length, 0); let t = start; const out: Cue[] = [];
  for (const p of parts) { const d = Math.min(6, Math.max(1, (seconds * p.length) / total)); out.push({ text: p, start: t, end: t + d }); t += d; }
  return out;
}

interface ReactorState { status: 'idle' | 'opening' | 'live' | 'fallback'; sessionId: string | null; prompt: string; inputs: string[] }

/** The room under the walkthrough. Brown noise through a low pass and a 55 hertz drone, never above minus thirty. */
function useRoom() {
  const ctx = useRef<AudioContext | null>(null); const bed = useRef<GainNode | null>(null); const drone = useRef<GainNode | null>(null);
  const start = useCallback(() => {
    if (ctx.current) { void ctx.current.resume(); return; }
    const c = new AudioContext(); ctx.current = c;
    const noise = c.createBuffer(1, c.sampleRate * 4, c.sampleRate); const d = noise.getChannelData(0); let b0 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.985 * b0 + 0.015 * w; d[i] = b0 * 2.5; }
    const src = c.createBufferSource(); src.buffer = noise; src.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = c.createGain(); g.gain.value = 0; src.connect(lp).connect(g).connect(c.destination); src.start(); bed.current = g; g.gain.linearRampToValueAtTime(0.03, c.currentTime + 4);
    const o = c.createOscillator(); o.frequency.value = 55; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; const dg = c.createGain(); dg.gain.value = 0; o.connect(f).connect(dg).connect(c.destination); o.start(); drone.current = dg;
  }, []);
  const setDrone = useCallback((on: boolean) => { const c = ctx.current; const g = drone.current; if (!c || !g) return; g.gain.cancelScheduledValues(c.currentTime); g.gain.linearRampToValueAtTime(on ? 0.02 : 0, c.currentTime + (on ? 6 : 4)); }, []);
  const stop = useCallback(() => { void ctx.current?.suspend(); }, []);
  return useMemo(() => ({ start, stop, setDrone }), [start, stop, setDrone]);
}

/**
 * The walkthrough. An introduction on black, the page, the photograph, a colour pass, then the
 * Reactor world with prompts drawn from the paper, the return to the page and the end. Every
 * move is one long ease with no cut, no blur anywhere, and the subtitles follow the narration.
 */
export function Walkthrough({ spec, onClose }: { spec: WalkthroughSpec; onClose: () => void }) {
  const [index, setIndex] = useState(-1); const [elapsed, setElapsed] = useState(0); const [ready, setReady] = useState(false);
  const [reactor, setReactor] = useState<ReactorState>({ status: 'idle', sessionId: null, prompt: '', inputs: [] });
  const [video, setVideo] = useState<string | null>(null);
  const voice = useRef<HTMLAudioElement>(null); const archive = useRef<HTMLAudioElement>(null); const room = useRoom(); const t0 = useRef(0); const raf = useRef(0);
  const segment = index >= 0 ? spec.segments[index] : undefined;

  useEffect(() => {
    const im = new Image(); im.src = publicUrl(spec.page); im.onload = () => setReady(true); im.onerror = () => setReady(true);
  }, [spec.page]);

  const begin = useCallback(() => { room.start(); t0.current = performance.now(); setIndex(0); }, [room]);

  useEffect(() => {
    if (!segment) return;
    t0.current = performance.now(); setElapsed(0);
    const v = voice.current; if (v) { v.pause(); if (segment.audio) { v.src = publicUrl(segment.audio); v.currentTime = 0; void v.play().catch(() => undefined); } }
    const a = archive.current; if (a) { a.pause(); if (segment.archive) { a.src = publicUrl(segment.archive); a.currentTime = 0; a.volume = 0.55; void a.play().catch(() => undefined); } }
    room.setDrone(segment.kind === 'page' || segment.kind === 'photo' || segment.kind === 'colour' || segment.kind === 'reactor');
    if (segment.kind === 'reactor') {
      setReactor({ status: 'opening', sessionId: null, prompt: segment.prompt ?? '', inputs: [] });
      fetch('/reactor/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seedUrl: publicUrl(spec.seed ?? spec.page), prompt: segment.prompt }) })
        .then(async r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ sessionId: string; streamUrl: string; fallbackUrl: string }>; })
        .then(body => {
          const probe = document.createElement('video'); probe.src = body.streamUrl; probe.muted = true;
          const timer = setTimeout(() => { probe.src = ''; setReactor(s => ({ ...s, status: 'fallback', sessionId: body.sessionId })); setVideo(null); }, 1500);
          probe.addEventListener('loadeddata', () => { clearTimeout(timer); setReactor(s => ({ ...s, status: 'live', sessionId: body.sessionId })); setVideo(body.streamUrl); }, { once: true });
          void probe.play().catch(() => undefined);
        })
        .catch(() => setReactor(s => ({ ...s, status: 'fallback' })));
    }
    const tick = () => { const e = (performance.now() - t0.current) / 1000; setElapsed(e); if (e >= segment.seconds) { setIndex(i => i + 1); return; } raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [segment, room, spec.seed, spec.page]);

  const stop = useMemo(() => segment?.stops?.filter(s => s.at <= elapsed).at(-1), [segment, elapsed]);
  useEffect(() => {
    if (!stop || !reactor.sessionId || reactor.inputs.includes(stop.prompt)) return;
    setReactor(s => ({ ...s, inputs: [...s.inputs, stop.prompt] }));
    void fetch('/reactor/session/' + reactor.sessionId + '/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: stop.prompt }) }).catch(() => undefined);
  }, [stop, reactor.sessionId, reactor.inputs]);

  useEffect(() => {
    if (index >= spec.segments.length) { room.stop(); if (reactor.sessionId) void fetch('/reactor/session/' + reactor.sessionId, { method: 'DELETE' }).catch(() => undefined); const t = setTimeout(onClose, 1800); return () => clearTimeout(t); }
  }, [index, spec.segments.length, onClose, room, reactor.sessionId]);

  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { room.stop(); onClose(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose, room]);

  const start = index >= 0 ? spec.segments.slice(0, index).reduce((n, s) => n + s.seconds, 0) : 0; const now = start + elapsed;
  const cues = useMemo(() => { let t = 0; const out: Cue[] = []; for (const s of spec.segments) { out.push(...cuesFor(s.text, t + 0.3, s.seconds - 0.6)); t += s.seconds; } return out; }, [spec.segments]);
  const cue = cues.find(c => now >= c.start && now < c.end);
  const archiveCue = segment?.archiveText && elapsed > 1.5 && elapsed < 9 ? segment.archiveText : null;

  const kind = segment?.kind ?? (index < 0 ? 'title' : 'end'); const done = index >= spec.segments.length;
  const p = spec.photo; const cx = (p.x + p.w / 2) * 100, cy = (p.y + p.h / 2) * 100;
  const inWorld = kind === 'reactor'; const inPhoto = kind === 'photo' || kind === 'colour' || inWorld;
  const pageStyle = { transform: kind === 'title' ? 'translate(-50%, 0) scale(1.06)' : kind === 'page' ? 'translate(-50%, -1.5%) scale(1.22)' : inPhoto ? 'translate(-50%, 0) scale(1)' : kind === 'return' ? 'translate(-50%, -4%) scale(1.4)' : 'translate(-50%, 0) scale(1.06)', opacity: kind === 'title' || done || kind === 'end' ? 0 : inPhoto ? 0 : 1, transformOrigin: kind === 'return' ? `${cx}% ${cy}%` : 'center top' } as const;
  const photoScale = kind === 'photo' ? 1.12 : kind === 'colour' ? 1.2 : inWorld ? 1.32 : 1;
  const colour = kind === 'colour' || inWorld;

  return (
    <section className={`walk walk--${kind} ${done ? 'walk--done' : ''}`} aria-label="Walkthrough">
      <div className="walk-stage">
        <img className="walk-page" src={publicUrl(spec.page)} alt="" draggable={false} style={pageStyle} />
        <div className="walk-photo" style={{ opacity: inPhoto ? 1 : 0, transform: `scale(${photoScale})` }}>
          {video && inWorld ? <video className="walk-video" src={video} autoPlay muted={false} playsInline /> : (
            <img src={publicUrl(spec.seed ?? spec.page)} alt="" draggable={false} className={`walk-crop ${colour ? 'walk-crop--colour' : ''} ${inWorld ? 'walk-crop--world' : ''}`} />
          )}
          <div className="walk-scan" style={{ opacity: inWorld ? 0.45 : 0 }} />
        </div>
        <div className="walk-veil" style={{ opacity: kind === 'title' || kind === 'end' || done || index < 0 ? 1 : 0 }} />
        <div className="walk-vignette" style={{ opacity: inWorld ? 0.5 : 0.15 }} />
        <div className="walk-bar walk-bar--top" /><div className="walk-bar walk-bar--bottom" />
      </div>

      <div className="walk-title" style={{ opacity: kind === 'title' && index >= 0 ? 1 : 0 }}>
        <span>{spec.date}</span><h2>{spec.title}</h2>
      </div>
      {index < 0 && <button className="walk-begin" onClick={begin} disabled={!ready}>{ready ? 'Begin the walkthrough' : 'Preparing the page'}</button>}

      <div className="walk-reactor" style={{ opacity: inWorld ? 1 : 0 }}>
        <span>Reactor · {reactor.status === 'live' ? 'live stream' : reactor.status === 'fallback' ? 'fallback picture' : 'opening session'}{reactor.sessionId ? ' · ' + reactor.sessionId.slice(0, 8) : ''}</span>
        <b>{stop?.label ?? ''}</b>
        <p>{stop?.prompt ?? reactor.prompt}</p>
      </div>

      <div className="walk-lanes">
        <div className="walk-dialogue" style={{ opacity: archiveCue ? 1 : 0 }}>{segment?.archiveSpeaker && <i>{segment.archiveSpeaker}</i>}{archiveCue}</div>
        <div className="walk-narrator" style={{ opacity: cue ? 1 : 0 }}>{cue?.text}</div>
      </div>

      <div className="walk-hud"><span>{Math.floor(now / 60)}:{String(Math.floor(now % 60)).padStart(2, '0')}</span><span>{segment?.id ?? (done ? 'end' : 'ready')}</span><button onClick={() => { room.stop(); onClose(); }}>Close</button></div>
      <audio ref={voice} preload="auto" /><audio ref={archive} preload="auto" />
    </section>
  );
}
