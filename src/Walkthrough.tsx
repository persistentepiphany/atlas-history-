import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeliosModel } from '@reactor-models/helios';

export interface Stop { at: number; label: string; prompt: string }
export interface Segment { id: string; kind: 'title' | 'page' | 'photo' | 'colour' | 'reactor' | 'return' | 'end'; seconds: number; audio?: string; voice?: string; text: string; archive?: string; archiveAt?: number; archiveText?: string; archiveSpeaker?: string; prompt?: string; stops?: Stop[] }
export interface WalkthroughSpec { id: string; title: string; date: string; page: string; photo: { x: number; y: number; w: number; h: number }; seed: string | null; seedCrop?: { x: number; y: number; w: number; h: number }; segments: Segment[] }

interface Cue { text: string; start: number; end: number }
const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

async function reactorSource(spec: WalkthroughSpec): Promise<Blob> {
  const response = await fetch(publicUrl(spec.seed ?? spec.page));
  if (!response.ok) throw new Error('Source image could not be loaded');
  const source = await response.blob(); if (!spec.seedCrop) return source;
  const bitmap = await createImageBitmap(source); const crop = spec.seedCrop;
  const sw = Math.round(bitmap.width * crop.w), sh = Math.round(bitmap.height * crop.h); const scale = Math.max(1, 768 / sw);
  const canvas = document.createElement('canvas'); canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')?.drawImage(bitmap, Math.round(bitmap.width * crop.x), Math.round(bitmap.height * crop.y), sw, sh, 0, 0, canvas.width, canvas.height); bitmap.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not crop the source photograph')), 'image/png'));
}

/** Sentences spread across a window by length, never shorter than a second, never longer than six. */
export function cuesFor(text: string, start: number, seconds: number): Cue[] {
  const parts = text.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
  const total = parts.reduce((n, p) => n + p.length, 0); let t = start; const out: Cue[] = [];
  for (const p of parts) { const d = Math.min(6, Math.max(1, (seconds * p.length) / total)); out.push({ text: p, start: t, end: t + d }); t += d; }
  return out;
}

interface ReactorState { status: 'idle' | 'opening' | 'waiting' | 'conditioning' | 'generating' | 'live' | 'fallback'; sessionId: string | null; prompt: string; inputs: string[]; detail?: string }

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
  const [interactivePrompt, setInteractivePrompt] = useState('');
  const [reactor, setReactor] = useState<ReactorState>({ status: 'idle', sessionId: null, prompt: '', inputs: [] });
  const [video, setVideo] = useState<MediaStream | null>(null); const model = useRef<HeliosModel | null>(null); const reactorOpening = useRef(false); const videoRef = useRef<HTMLVideoElement>(null);
  const voice = useRef<HTMLAudioElement>(null); const archive = useRef<HTMLAudioElement>(null); const room = useRoom(); const t0 = useRef(0); const raf = useRef(0);
  const segment = index >= 0 ? spec.segments[index] : undefined;

  useEffect(() => {
    const im = new Image(); im.src = publicUrl(spec.page); im.onload = () => setReady(true); im.onerror = () => setReady(true);
  }, [spec.page]);

  const begin = useCallback(() => { room.start(); t0.current = performance.now(); setIndex(0); }, [room]);

  const closeReactor = useCallback(() => {
    reactorOpening.current = false; setVideo(null); const current = model.current; model.current = null;
    if (current) void current.disconnect().catch(() => undefined);
  }, []);

  const openReactor = useCallback(async () => {
    if (reactorOpening.current || model.current) return;
    reactorOpening.current = true; setReactor({ status: 'opening', sessionId: null, prompt: spec.segments.find(s => s.kind === 'reactor')?.prompt ?? '', inputs: [], detail: 'Authorising Reactor' });
    const current = new HeliosModel(); model.current = current;
    current.on('statusChanged', status => setReactor(s => ({ ...s, status: status === 'waiting' ? 'waiting' : status === 'ready' ? 'conditioning' : s.status, sessionId: current.getSessionId() ?? s.sessionId, detail: status === 'waiting' ? 'Warming the model' : 'Preparing the newspaper image' })));
    current.onMainVideo((_track, stream) => { setVideo(stream); setReactor(s => ({ ...s, status: 'generating', sessionId: current.getSessionId() ?? null, detail: 'Receiving the first video frame' })); });
    current.onGenerationStarted(() => setReactor(s => ({ ...s, status: 'generating', detail: 'Helios accepted generation' })));
    current.onCommandError(message => setReactor(s => ({ ...s, status: 'fallback', detail: `${message.command}: ${message.reason}` })));
    current.onState(message => { if (message.current_frame > 0) setReactor(s => ({ ...s, detail: `Receiving frame ${message.current_frame}` })); });
    current.on('error', error => setReactor(s => ({ ...s, status: 'fallback', detail: error.message })));
    try {
      const tokenResponse = await fetch('/reactor/token', { method: 'POST' }); const token = await tokenResponse.json() as { jwt?: string; error?: string };
      if (!tokenResponse.ok || !token.jwt) throw new Error(token.error || 'Reactor authorisation failed');
      await current.connect(token.jwt); setReactor(s => ({ ...s, status: 'conditioning', sessionId: current.getSessionId() ?? null, detail: 'Uploading the source image' }));
      const image = await current.uploadFile(await reactorSource(spec), { name: (spec.seed ?? spec.page).split('/').at(-1) ?? 'newspaper.png' });
      const prompt = spec.segments.find(s => s.kind === 'reactor')?.prompt ?? spec.title;
      const ensureCommand = (name: string) => { const lastError = current.getLastError(); if (lastError) throw new Error(`${name}: ${lastError.message}`); };
      await current.setConditioning({ image, prompt }); ensureCommand('conditioning');
      await current.setImageStrength({ image_strength: .9 }); ensureCommand('image strength');
      await current.setSrScale({ sr_scale: 'off' }); ensureCommand('super resolution');
      setReactor(s => ({ ...s, status: 'generating', detail: 'Generating the first frame' })); await current.start(); ensureCommand('generation');
    } catch (error) { setReactor(s => ({ ...s, status: 'fallback', detail: error instanceof Error ? error.message : 'Reactor unavailable' })); }
    finally { reactorOpening.current = false; }
  }, [spec]);

  useEffect(() => { if (index === 0) void openReactor(); }, [index, openReactor]);
  useEffect(() => { if (videoRef.current) { videoRef.current.srcObject = video; if (video) void videoRef.current.play().catch(() => undefined); } }, [video]);

  useEffect(() => {
    if (!segment) return;
    let archiveTimer = 0;
    t0.current = performance.now(); setElapsed(0);
    const v = voice.current; if (v) { v.pause(); if (segment.audio) { v.src = publicUrl(segment.audio); v.currentTime = 0; void v.play().catch(() => undefined); } }
    const a = archive.current; if (a) { a.pause(); if (segment.archive) { a.src = publicUrl(segment.archive); a.currentTime = 0; a.volume = 0.55; archiveTimer = window.setTimeout(() => void a.play().catch(() => undefined), (segment.archiveAt ?? 0) * 1000); } }
    room.setDrone(segment.kind === 'page' || segment.kind === 'photo' || segment.kind === 'colour' || segment.kind === 'reactor');
    if (segment.kind === 'colour' || segment.kind === 'reactor') void openReactor();
    const tick = () => { const e = (performance.now() - t0.current) / 1000; setElapsed(e); if (e >= segment.seconds) { setIndex(i => i + 1); return; } raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf.current); clearTimeout(archiveTimer); a?.pause(); };
  }, [segment, room, openReactor]);

  const stop = useMemo(() => segment?.stops?.filter(s => s.at <= elapsed).at(-1), [segment, elapsed]);
  useEffect(() => {
    if (!stop || !model.current || reactor.inputs.includes(stop.prompt)) return;
    setReactor(s => ({ ...s, inputs: [...s.inputs, stop.prompt] }));
    void model.current.setPrompt({ prompt: stop.prompt });
  }, [stop, reactor.inputs]);

  useEffect(() => { if (index >= spec.segments.length) { room.stop(); voice.current?.pause(); archive.current?.pause(); } }, [index, spec.segments.length, room]);

  const directWorld = useCallback(async (event: React.FormEvent) => {
    event.preventDefault(); const prompt = interactivePrompt.trim(); const current = model.current; if (!prompt || !current) return;
    setInteractivePrompt(''); setReactor(s => ({ ...s, prompt, inputs: [...s.inputs, prompt], detail: 'Applying your direction' }));
    await current.setPrompt({ prompt }); const error = current.getLastError();
    setReactor(s => error ? ({ ...s, status: 'fallback', detail: error.message }) : ({ ...s, detail: s.status === 'live' ? 'Live Helios stream · direction applied' : 'Direction applied' }));
  }, [interactivePrompt]);

  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { room.stop(); closeReactor(); onClose(); } }; window.addEventListener('keydown', key); return () => { window.removeEventListener('keydown', key); closeReactor(); }; }, [onClose, room, closeReactor]);

  const start = index >= 0 ? spec.segments.slice(0, index).reduce((n, s) => n + s.seconds, 0) : 0; const now = start + elapsed;
  const cues = useMemo(() => { let t = 0; const out: Cue[] = []; for (const s of spec.segments) { out.push(...cuesFor(s.text, t + 0.3, s.seconds - 0.6)); t += s.seconds; } return out; }, [spec.segments]);
  const cue = cues.find(c => now >= c.start && now < c.end);
  const archiveAt = segment?.archiveAt ?? 0; const archiveCue = segment?.archiveText && elapsed > archiveAt && elapsed < archiveAt + 7.5 ? segment.archiveText : null;

  const done = index >= spec.segments.length; const kind = done ? 'reactor' : segment?.kind ?? (index < 0 ? 'title' : 'end');
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
          <img src={publicUrl(spec.seed ?? spec.page)} alt="" draggable={false} className={`walk-crop ${colour ? 'walk-crop--colour' : ''} ${inWorld ? 'walk-crop--world' : ''}`} />
          {video && <video ref={videoRef} className="walk-video" autoPlay muted playsInline onCanPlay={() => setReactor(s => ({ ...s, status: 'live', detail: 'Live Helios stream' }))} style={{ opacity: inWorld && reactor.status === 'live' ? 1 : 0 }} />}
          <div className="walk-scan" style={{ opacity: inWorld ? 0.45 : 0 }} />
        </div>
        <div className="walk-veil" style={{ opacity: kind === 'title' || kind === 'end' || index < 0 ? 1 : 0 }} />
        <div className="walk-vignette" style={{ opacity: inWorld ? 0.5 : 0.15 }} />
        <div className="walk-bar walk-bar--top" /><div className="walk-bar walk-bar--bottom" />
      </div>

      <div className="walk-title" style={{ opacity: kind === 'title' && index >= 0 ? 1 : 0 }}>
        <span>{spec.date}</span><h2>{spec.title}</h2>
      </div>
      {index < 0 && <button className="walk-begin" onClick={begin} disabled={!ready}>{ready ? 'Begin the walkthrough' : 'Preparing the page'}</button>}

      <div className="walk-reactor" style={{ opacity: inWorld ? 1 : 0 }}>
        <span className={reactor.status !== 'live' && reactor.status !== 'fallback' ? 'walk-reactor-loading' : ''}>Reactor · {reactor.status === 'live' ? 'live Helios stream' : reactor.status === 'fallback' ? `source image fallback${reactor.detail ? ' · ' + reactor.detail : ''}` : reactor.detail ?? 'loading animated world'}{reactor.sessionId ? ' · ' + reactor.sessionId.slice(0, 8) : ''}</span>
        <b>{done ? 'Walkthrough complete — direct the world' : stop?.label ?? ''}</b>
        <p>{done ? reactor.prompt : stop?.prompt ?? reactor.prompt}</p>
      </div>

      {done && <form className="walk-interact" onSubmit={directWorld}>
        <label htmlFor="world-direction">What happens next?</label>
        <div><input id="world-direction" value={interactivePrompt} onChange={event => setInteractivePrompt(event.target.value)} placeholder="Move closer to the ladder…" autoFocus /><button type="submit" disabled={!interactivePrompt.trim() || !model.current}>Generate</button></div>
        <small>Keep directing the live image, or Close to return to the newspaper.</small>
      </form>}

      <div className="walk-lanes">
        <div className="walk-dialogue" style={{ opacity: archiveCue ? 1 : 0 }}>{segment?.archiveSpeaker && <i>{segment.archiveSpeaker}</i>}{archiveCue}</div>
        <div className="walk-narrator" style={{ opacity: cue ? 1 : 0 }}>{cue && <span key={cue.start} className="walk-typewriter">{cue.text}</span>}</div>
      </div>

      <div className="walk-hud"><span>{Math.floor(now / 60)}:{String(Math.floor(now % 60)).padStart(2, '0')}</span><span>{segment?.id ?? (done ? 'end' : 'ready')}</span><button onClick={() => { room.stop(); closeReactor(); onClose(); }}>Close</button></div>
      <audio ref={voice} preload="auto" /><audio ref={archive} preload="auto" />
    </section>
  );
}
