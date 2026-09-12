import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { catalogue } from '../data/client';
import { audioSrc, type Cluster, type Scenario, type WordBox } from '../data/types';
import { usePhases } from '../sequence/phases';
import { makeSampler, createSheet } from '../sequence/theatre';
import { phaseAt } from '../sequence/beats';
import { AudioGraph } from '../audio/graph';
import { PagePlane } from '../scene/PagePlane';
import { HighlightPlane } from '../scene/HighlightPlane';
import { Effects } from '../scene/Effects';
import { CameraRig } from '../scene/CameraRig';
import { Letterbox } from '../overlay/Letterbox';
import { TitleCard } from '../overlay/TitleCard';
import { ObjectiveCard } from '../overlay/ObjectiveCard';
import { WireCard } from '../overlay/WireCard';
import { Provenance, type ProjectedMark } from '../overlay/Provenance';
import { Hub, type HubHandoff } from '../hub/Hub';
import { WorldOrchestrator, type WorldMode, type OrchestratorState } from '../world/WorldOrchestrator';
import { WorldSurface } from '../world/WorldSurface';
import { reactorConfig } from '../world/config';

interface Aligned { page: string; w: WordBox; start: number; end: number; driftLine?: number }

declare global { interface Window { __atlas?: { phase: string; t: number; world: OrchestratorState | null; running: boolean } } }

function buildAlign(sc: Scenario, words: Record<string, WordBox[]>, lines: Record<string, { text: string; y: number; h: number; x?: number; w?: number }[]>): Aligned[] {
  const al: Aligned[] = []; const a = sc.align as Record<string, { start: number; end?: number; rate?: number; words?: [number, number]; page?: string; match?: string }>;
  const rw = words[sc.readPage] ?? [];
  if (a.headline?.words) { const [s, e] = a.headline.words; const n = e - s; for (let i = s; i < e; i++) { const w = rw[i]; if (w) al.push({ page: sc.readPage, w, start: a.headline.start + ((a.headline.end ?? 0) - a.headline.start) * (i - s) / n, end: a.headline.start + ((a.headline.end ?? 0) - a.headline.start) * (i - s + 0.9) / n }); } }
  if (a.lead?.words) { const [s, e] = a.lead.words; let t = a.lead.start; for (let i = s; i < e; i++) { const w = rw[i]; if (!w) break; const d = (0.6 + 0.08 * w.w.length) / (a.lead.rate ?? 2.6); al.push({ page: sc.readPage, w, start: t, end: t + d * 0.92 }); t += d; } }
  if (a.memo?.page && a.memo.match) { const ws = words[a.memo.page] ?? []; const target = a.memo.match.split(' '); const idx = ws.findIndex((_, i) => target.every((tw, j) => ws[i + j]?.w === tw)); if (idx >= 0) target.forEach((_, j) => al.push({ page: a.memo!.page!, w: ws[idx + j]!, start: a.memo!.start + ((a.memo!.end ?? 0) - a.memo!.start) * j / target.length, end: a.memo!.start + ((a.memo!.end ?? 0) - a.memo!.start) * (j + 0.9) / target.length })); }
  if (a.drift) { const ls = lines[sc.readPage] ?? []; ls.forEach((l, i) => al.push({ page: sc.readPage, w: { w: '', x: l.x ?? 0, y: l.y, width: l.w ?? 0, height: l.h, conf: 1, line: i }, start: a.drift!.start + ((a.drift!.end ?? 0) - a.drift!.start) * i / ls.length, end: a.drift!.start + ((a.drift!.end ?? 0) - a.drift!.start) * (i + 1) / ls.length, driftLine: i })); }
  return al;
}

/** Drives the sheet position from wall time and reports it. Phase changes come from the position crossing beat times. */
function Clock({ running, paused, speed, onTick }: { running: boolean; paused: boolean; speed: number; onTick: (dt: number) => void }) {
  useFrame((_, dt) => { if (running && !paused) onTick(Math.min(0.1, dt) * speed); });
  return null;
}

const params = new URLSearchParams(location.search);
/** live=1 forces the live chain, live=0 the fallback chain, otherwise reactor.config.json decides. */
const worldMode: WorldMode = params.get('live') === '1' ? 'live' : params.get('live') === '0' ? 'fallback' : params.get('world') === 'seed' ? 'seed' : 'auto';

export function App() {
  const [clusters, setClusters] = useState<Cluster[]>([]); const [sc, setSc] = useState<Scenario | null>(null);
  const [words, setWords] = useState<Record<string, WordBox[]>>({}); const [lines, setLines] = useState<Record<string, { text: string; y: number; h: number; x?: number; w?: number }[]>>({});
  const [running, setRunning] = useState(false); const [paused, setPaused] = useState(false); const [, force] = useState(0);
  const T = useRef(0); const fired = useRef(new Set<number>()); const audio = useRef<AudioGraph | null>(null);
  const [orch, setOrch] = useState<WorldOrchestrator | null>(null); const orchRef = useRef<WorldOrchestrator | null>(null);
  const [caption, setCaption] = useState<{ text: string; kind: 'voice' | 'archive' | 'read'; until: number | null }>({ text: '', kind: 'voice', until: null });
  const [wire, setWire] = useState<{ time: string; agency: string; text: string; until: number } | null>(null); const [objective, setObjective] = useState(false);
  const { phase, setPhase, setEvent, resolvedMarks, resolveMark, provenanceVisible, stopIndex, setStop } = usePhases();

  useEffect(() => { void catalogue.listClusters().then(setClusters); }, []);
  const choose = useCallback(async (id: string) => {
    const s = await catalogue.getScenario(id); const w: Record<string, WordBox[]> = {}; const l: typeof lines = {};
    for (const [pid, p] of Object.entries(s.pages)) {
      if (p.words) w[pid] = (await (await fetch('/' + p.words)).json()) as WordBox[];
      if (p.lines) l[pid] = await (await fetch('/' + p.lines)).json();
      if (p.syntheticLines) { const sl = p.syntheticLines; l[pid] = Array.from({ length: sl.count }, (_, i) => ({ text: '', x: sl.x, w: sl.w, y: sl.y0 + (sl.y1 - sl.y0) * i / sl.count, h: (sl.y1 - sl.y0) / sl.count * 0.8 })); }
    }
    orchRef.current?.dispose(); orchRef.current = null; setOrch(null);
    setSc(s); setWords(w); setLines(l); setEvent(id); T.current = 0; fired.current.clear(); setRunning(false); setStop(-1); setObjective(false); setWire(null); setCaption({ text: '', kind: 'voice', until: null });
    createSheet(s, await fetch('/scenarios/' + id + '.theatre.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }, [setEvent, setStop]);
  useEffect(() => { if (clusters[0] && !sc) void choose(params.get('event') ?? clusters[0].id); }, [clusters, sc, choose]);

  const sample = useMemo(() => (sc ? makeSampler(sc) : null), [sc]);
  const align = useMemo(() => (sc ? buildAlign(sc, words, lines) : []), [sc, words, lines]);

  /** The world is created at the first door beat, entered at the world beat, stepped at each stop and closed at return. Every time and label comes from the scenario. */
  const openWorld = useCallback(() => {
    if (!sc || orchRef.current) return;
    const a = audio.current;
    const o = new WorldOrchestrator(sc, { now: () => T.current, mode: worldMode, audio: a ? { play: (id, until) => a.play(id, until), attachWorld: (el) => a.attachWorld(el), releaseWorld: (ms) => a.releaseWorld(ms) } : undefined });
    orchRef.current = o; setOrch(o); void o.door();
  }, [sc]);

  const schedule = useMemo(() => {
    if (!sc) return [] as { t: number; run: () => void }[]; const ev: { t: number; run: () => void }[] = [];
    const door = sc.beats.find((b) => b.phase === 'door'); const world = sc.beats.find((b) => b.phase === 'world'); const ret = sc.beats.find((b) => b.phase === 'return');
    for (const b of sc.beats) {
      if (b.voice) ev.push({ t: b.voice.at ?? b.t, run: () => setCaption({ text: b.voice!.text, kind: 'voice', until: T.current + (b.voice!.dur ?? 6) }) });
      if (b.caption) ev.push({ t: b.t, run: () => setCaption({ text: b.caption!.text, kind: b.caption!.kind as 'archive', until: b.caption!.dur ? T.current + b.caption!.dur : null }) });
      for (const a of b.archive ?? []) ev.push({ t: a.at ?? b.t - 0.25, run: () => audio.current?.play(a.id, a.until ?? b.t + 10) });
      for (const f of b.foley ?? []) ev.push({ t: f.at ?? b.t, run: () => audio.current?.play(f.id, f.until ?? T.current + 2) });
      if (b.objective) ev.push({ t: b.objective.at, run: () => setObjective(true) });
      if (b.wire) ev.push({ t: b.t, run: () => setWire({ ...b.wire!, until: T.current + b.wire!.dur }) });
      if (b.resolved) ev.push({ t: b.t, run: () => resolveMark(sc.readPage) });
    }
    if (door) ev.push({ t: door.t, run: openWorld });
    if (world) ev.push({ t: world.t, run: () => { openWorld(); orchRef.current?.world(); } });
    if (ret) ev.push({ t: ret.t, run: () => { void orchRef.current?.leave(); setObjective(false); } });
    const lead = reactorConfig.audioLeadMs / 1000;
    sc.world.stops.forEach((s, i) => ev.push({ t: s.t - lead, run: () => { setStop(i); if (s.text) setCaption({ text: s.text, kind: 'voice', until: T.current + 11 }); void orchRef.current?.enterStop(i); } }));
    return ev.sort((a, b) => a.t - b.t);
  }, [sc, resolveMark, setStop, openWorld]);

  const start = useCallback(async () => {
    if (!sc) return; if (!audio.current) { audio.current = new AudioGraph('/assets/library/beds/b01.wav'); for (const [id, entry] of Object.entries(sc.audio)) { const src = audioSrc(entry); if (!/^https?:/.test(src)) audio.current.register(id, '/' + src, 'archive'); } ['F01', 'F02', 'F03', 'F04'].forEach((f) => audio.current!.register(f, '/assets/library/foley/' + f.toLowerCase() + '.wav', 'foley')); }
    await audio.current.start(); T.current = 0; fired.current.clear(); setRunning(true); setPaused(false);
  }, [sc]);
  const seek = useCallback((t: number) => { schedule.forEach((e, i) => { if (e.t < t) fired.current.add(i); }); T.current = t; }, [schedule]);
  const onHubSelect = useCallback((_h: HubHandoff) => { if (!running) void start(); else if (T.current < 8) seek(8); }, [running, start, seek]);
  useEffect(() => { if (sc && !running && params.get('autostart') === '1' && !fired.current.size) { void start().then(() => { const at = Number(params.get('at')); if (at > 0) seek(at); }); } }, [sc, running, start, seek]);
  const advanceStop = useCallback(() => {
    if (!sc || phase !== 'world') return; if (orchRef.current && !orchRef.current.canAdvance()) return;
    const lead = reactorConfig.audioLeadMs / 1000; const next = sc.world.stops.find((s) => s.t - lead > T.current + 0.01);
    if (next) seek(next.t - lead); else { const ret = sc.beats.find((b) => b.phase === 'return'); if (ret) seek(ret.t); }
  }, [sc, phase, seek]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); } if (e.key === 'ArrowRight') advanceStop(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [advanceStop]);
  useEffect(() => { if (paused) orchRef.current?.pause(); else orchRef.current?.resume(); }, [paused]);
  const onLook = useCallback((e: React.PointerEvent) => { if (phase !== 'world') return; const m = reactorConfig.maxLookOffset; orchRef.current?.look(((e.clientX / window.innerWidth) - 0.5) * 2 * m, ((e.clientY / window.innerHeight) - 0.5) * 2 * m); }, [phase]);

  const onTick = useCallback((dt: number) => {
    if (!sc) return; T.current += dt; const t = T.current;
    schedule.forEach((e, i) => { if (!fired.current.has(i) && e.t <= t) { fired.current.add(i); if (t - e.t < 1.5) e.run(); } });
    const ph = phaseAt(sc, t); if (ph !== phase) setPhase(ph);
    if (caption.until != null && t > caption.until) setCaption((c) => ({ ...c, text: '' }));
    if (wire && t > wire.until) setWire(null);
    audio.current?.tick(t); audio.current?.setBed(provenanceVisible ? 0 : sample!('bed', t));
    orchRef.current?.setMix(provenanceVisible ? 0 : sample!('world.mix', t));
    if (t > sc.beats[sc.beats.length - 1]!.t + 3.5) { setRunning(false); audio.current?.stopCurrent(); }
    force((n) => n + 1);
  }, [sc, schedule, phase, setPhase, caption.until, wire, provenanceVisible, sample]);

  if (!sc || !sample) return <div className="ui fixed inset-0 grid place-items-center">Loading</div>;
  const t = T.current; const prov = provenanceVisible; const page = sc.pages[sc.readPage]!;
  if (params.get('debug') === '1') window.__atlas = { phase, t, world: orchRef.current?.getState() ?? null, running };
  const cur = running ? align.find((a) => t >= a.start && t < a.end) : undefined; const beat = [...sc.beats].reverse().find((b) => b.t <= t);
  const tracking = running && !!beat && (beat.track || beat.drift) && !sc.beats.some((b) => b.t > beat.t && b.t <= t);
  const trackY = tracking && cur && cur.page === sc.readPage ? page.y + (cur.w.y + cur.w.height / 2) * page.h + 2 * sc.lineHeight * page.h : null;
  const cam = { x: sample('camera.x', t), y: sample('camera.y', t), z: sample('camera.z', t), trackY };
  const focus = { x: cur ? sc.pages[cur.page]!.x + (cur.w.x + cur.w.width / 2) * sc.pages[cur.page]!.w : sample('focus.x', t), y: cur ? sc.pages[cur.page]!.y + (cur.w.y + cur.w.height / 2) * sc.pages[cur.page]!.h : sample('focus.y', t), radius: sample('focus.radius', t) };
  const mix = prov ? 0 : sample('world.mix', t);
  const s = window.innerHeight / (2 * Math.tan((17.5 * Math.PI) / 180)) / cam.z; const proj = (u: number, v: number): [number, number] => [window.innerWidth / 2 + (u - cam.x) * s, window.innerHeight / 2 + (v - cam.y) * s];
  const focusNdc = proj(focus.x, focus.y);
  const marks: ProjectedMark[] = sc.marks.map((m) => { const p = sc.pages[m.page]!; const [x0, y0] = proj(p.x + m.x * p.w, p.y + m.y * p.h); const [x1, y1] = proj(p.x + (m.x + m.w) * p.w, p.y + (m.y + m.h) * p.h); return { label: m.label, source: m.source, x: x0, y: y0, w: x1 - x0, h: y1 - y0, outline: m.outline, visible: !m.provenanceOnly && running && m.from != null && t >= m.from && phase !== 'hub' && phase !== 'world' }; });
  const cluster = clusters.find((c) => c.id === sc.id) ?? { id: sc.id, label: sc.title, date: sc.date, pages: [] }; const lb = sample('letterbox', t);
  const readLine = cur?.driftLine != null ? sc.readLines?.[Math.min((sc.readLines?.length ?? 1) - 1, Math.floor((cur.driftLine / align.length) * (sc.readLines?.length ?? 1)))] : cur?.w.line != null ? lines[sc.readPage]?.[cur.w.line]?.text : undefined;
  const stops = sc.world.stops;

  return (
    <div className="fixed inset-0 bg-black" onClick={advanceStop} onPointerMove={onLook}>
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: false }} style={{ position: 'fixed', inset: 0 }}>
        <Clock running={running} paused={paused} speed={Number(params.get('speed')) || 1} onTick={onTick} />
        <CameraRig target={cam} time={t} />
        <Suspense fallback={null}>
          {Object.entries(sc.pages).map(([id, p]) => { const slide = p.slideFrom != null ? p.slideFrom + (p.x - p.slideFrom) * sample('plane.' + id + '.slide', t) : p.x; return <PagePlane key={id} src={'/' + p.src} x={slide} y={p.y} w={p.w} h={p.h} opacity={sample('plane.' + id + '.o', t)} />; })}
          <HighlightPlane src={'/' + page.src} x={page.x} y={page.y} w={page.w} h={page.h} box={cur && cur.page === sc.readPage && !prov ? [cur.w.x, cur.w.y, cur.w.width, cur.w.height] : [0, 0, 0, 0]} strength={cur ? 1 : 0} desat={sample('desat', t)} marks={sc.marks.filter((m) => m.page === sc.readPage && (prov || (m.from != null && t >= m.from))).map((m) => [m.x, m.y, m.w, m.h])} provenance={prov} />
          {!prov && <PagePlane src={'/' + ((beat?.ghost?.src) ?? sc.ghost.src)} x={page.x + sc.ghost.x * page.w} y={page.y + sc.ghost.y * page.w} w={sc.ghost.w * page.w * sample('ghost.scale', t)} h={sc.ghost.h * page.w * sample('ghost.scale', t)} opacity={Math.min(0.35, sample('ghost.opacity', t))} />}
        </Suspense>
        <Effects grain={prov ? 0.04 : sample('post.grain', t)} vignette={prov ? 0.15 : sample('post.vignette', t)} aberration={prov ? 0 : sample('post.aberration', t)} warmth={prov ? 0 : sample('warmth', t)} focus={{ cx: focusNdc[0] / window.innerWidth, cy: 1 - focusNdc[1] / window.innerHeight, radius: focus.radius * 0.5, enabled: !prov && mix < 0.5 && focus.radius < 0.98 }} />
      </Canvas>
      <WorldSurface orch={orch} provenance={prov} model={sc.world.model ?? reactorConfig.defaultModel} />
      <Hub cluster={cluster} resolved={resolvedMarks} visible={!running && phase === 'hub'} onSelect={onHubSelect} />
      <Letterbox amount={lb} />
      <TitleCard text={readLine ?? caption.text} kind={readLine ? 'read' : caption.kind} letterbox={lb} />
      <ObjectiveCard text={sc.world.objective} visible={objective && phase === 'world'} resolved={stopIndex === stops.length - 1} letterbox={lb} />
      <WireCard time={wire?.time ?? ''} agency={wire?.agency ?? ''} text={wire?.text ?? ''} visible={!!wire} />
      <Provenance marks={marks} />
      <div className="ui pointer-events-none fixed bottom-[18px] left-8 flex gap-4"><span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>{Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}{paused ? '  paused' : ''}</span><span style={{ opacity: 0.45 }}>{phase}{phase === 'world' && stopIndex >= 0 ? '  ·  ' + stops[stopIndex]!.label : ''}</span></div>
      <div className="ui fixed left-8 top-6 flex gap-4" style={{ opacity: phase === 'hub' ? 1 : 0, pointerEvents: running ? 'none' : 'auto' }}>{clusters.map((c) => <button key={c.id} onClick={(e) => { e.stopPropagation(); void choose(c.id); }} style={{ borderBottom: c.id === sc.id ? '1px solid rgba(235,230,220,0.7)' : '1px solid transparent', opacity: c.id === sc.id ? 1 : 0.5 }}>{c.label}</button>)}</div>
    </div>
  );
}
