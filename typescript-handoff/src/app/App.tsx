import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { catalogue } from '../data/client';
import { clipSrc, clipStart, type Beat, type Cluster, type LineBox, type Scenario, type Stop, type WordBox } from '../data/types';
import { preload, resolveClip } from '../data/preload';
import { usePhases } from '../sequence/phases';
import { makeSampler, createSheet, type Sampler } from '../sequence/theatre';
import { beatAt, phaseAt } from '../sequence/beats';
import { MasterClock } from '../sequence/clock';
import { buildAlign, type Aligned } from '../sequence/align';
import { ManualVeil, VEIL_HOLD, VEIL_RAMP, veilAt, veilWindows } from '../sequence/transitions';
import { AudioGraph, AUDIO_LEAD, RETURN_TAIL } from '../audio/graph';
import { RISER_LENGTH } from '../audio/drones';
import { cueAt, cuesFromText, type Cue } from '../subtitles/chunk';
import { PagePlane } from '../scene/PagePlane';
import { HighlightPlane } from '../scene/HighlightPlane';
import { GhostPlane } from '../scene/GhostPlane';
import { PhotoPlane } from '../scene/PhotoPlane';
import { WorldPlane } from '../scene/WorldPlane';
import { Effects } from '../scene/Effects';
import { CameraRig } from '../scene/CameraRig';
import { Letterbox } from '../overlay/Letterbox';
import { Subtitles } from '../overlay/Subtitles';
import { ObjectiveCard } from '../overlay/ObjectiveCard';
import { WireCard } from '../overlay/WireCard';
import { Translation } from '../overlay/Translation';
import { Veil } from '../overlay/Veil';
import { Provenance, type ProjectedMark } from '../overlay/Provenance';
import { Hub, type HubLabel } from '../hub/Hub';
import { Catalogue } from '../hub/Catalogue';
import { LiveReactorSource } from '../world/LiveReactorSource';
import { FallbackSource } from '../world/FallbackSource';
import type { WorldSource } from '../world/WorldSource';
import { useReducedMotion } from './motion';

const FOV = 35;
const SCRUB_STEP = 5;
/** Dot cell in CSS pixels at a camera distance. Closer camera, larger printed dots. */
export function dotCell(cameraZ: number) { return Math.min(64, Math.max(8, 2.0 / cameraZ)); }

type View = 'catalogue' | 'hub';
interface Lanes { dialogue: Cue[]; narrator: Cue[] }
interface Loaded { sc: Scenario; words: Record<string, WordBox[]>; lines: Record<string, LineBox[]>; align: Aligned[]; sample: Sampler }

/** Review controls read once from the query string. speed multiplies frame time and startAt seeks on begin. */
const QUERY = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const SPEED = Math.max(0.25, Math.min(8, Number(QUERY.get('speed')) || 1));
const START_AT = Math.max(0, Number(QUERY.get('startAt')) || 0);

/** Drives the master clock from frame time and reports each tick. */
function Ticker({ onTick }: { onTick: (dt: number) => void }) {
  useFrame((_, dt) => onTick(Math.min(0.1, dt) * SPEED));
  return null;
}

async function loadEvent(id: string): Promise<Loaded> {
  const sc = await catalogue.getScenario(id); const words: Record<string, WordBox[]> = {}; const lines: Record<string, LineBox[]> = {};
  for (const [pid, p] of Object.entries(sc.pages)) {
    if (p.words) words[pid] = (await (await fetch('/' + p.words)).json()) as WordBox[];
    if (p.lines) lines[pid] = (await (await fetch('/' + p.lines)).json()) as LineBox[];
    if (p.syntheticLines) { const sl = p.syntheticLines; lines[pid] = Array.from({ length: sl.count }, (_, i) => ({ text: '', x: sl.x, w: sl.w, y: sl.y0 + (sl.y1 - sl.y0) * i / sl.count, h: (sl.y1 - sl.y0) / sl.count * 0.8 })); }
  }
  createSheet(sc, await fetch('/scenarios/' + id + '.theatre.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return { sc, words, lines, align: buildAlign(sc, words, lines), sample: makeSampler(sc) };
}

export function App() {
  const reducedMotion = useReducedMotion();
  const [clusters, setClusters] = useState<Cluster[]>([]); const [view, setView] = useState<View>('catalogue');
  const [loaded, setLoaded] = useState<Loaded | null>(null); const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false); const [paused, setPaused] = useState(false); const [, force] = useState(0);
  const clock = useRef(new MasterClock()); const fired = useRef(new Set<number>()); const audio = useRef<AudioGraph | null>(null);
  const world = useRef<WorldSource | null>(null); const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const lanes = useRef<Lanes>({ dialogue: [], narrator: [] }); const veil = useRef(new ManualVeil(1));
  const [wire, setWire] = useState<{ time: string; agency: string; text: string; until: number } | null>(null); const [objective, setObjective] = useState(false);
  const [translateKey, setTranslateKey] = useState<string | null>(null); const seekRef = useRef<((t: number) => void) | null>(null); const stopEnteredAt = useRef(0); const smoothedY = useRef<number | null>(null);
  const { phase, setPhase, setEvent, resolvedMarks, resolveMark, provenanceVisible, stopIndex, setStop } = usePhases();

  useEffect(() => { void catalogue.listClusters().then(setClusters); }, []);

  const resetSequence = useCallback(() => {
    clock.current.reset(0); fired.current.clear(); lanes.current = { dialogue: [], narrator: [] }; setStop(-1); setObjective(false); setWire(null); setTranslateKey(null); setRunning(false); setPaused(false);
    audio.current?.stopCurrent(); audio.current?.cancelRiser(); world.current?.close(); world.current = null; setVideo(null);
  }, [setStop]);

  /** Catalogue to hub. The catalogue fades over the veil, the veil holds, then falls once every asset is in cache. */
  const choose = useCallback(async (id: string) => {
    resetSequence(); setReady(false); veil.current.set(1, performance.now() / 1000, 0.05);
    const l = await loadEvent(id); setLoaded(l); setEvent(id); setView('hub');
    await preload(l.sc, '/');
    setTimeout(() => veil.current.set(0, performance.now() / 1000, reducedMotion ? 0.2 : VEIL_RAMP), (reducedMotion ? 0.2 : VEIL_RAMP + VEIL_HOLD) * 1000);
    setReady(true);
  }, [resetSequence, setEvent, reducedMotion]);

  /** Hub to catalogue. The veil rises, the catalogue fades in over it, the room tone stays under the dark. */
  const toCatalogue = useCallback(() => {
    veil.current.set(1, performance.now() / 1000, reducedMotion ? 0.2 : VEIL_RAMP); audio.current?.setBed(0); audio.current?.readDroneOff(); audio.current?.worldOff();
    setTimeout(() => { resetSequence(); setView('catalogue'); }, (reducedMotion ? 0.2 : VEIL_RAMP) * 1000);
  }, [resetSequence, reducedMotion]);

  const sc = loaded?.sc ?? null; const sample = loaded?.sample ?? null;
  const windows = useMemo(() => (sc ? veilWindows(sc) : []), [sc]);
  const worldBeat = useMemo(() => sc?.beats.find((b) => b.phase === 'world'), [sc]);
  const returnBeat = useMemo(() => sc?.beats.find((b) => b.phase === 'return'), [sc]);
  const firstRead = useMemo(() => sc?.beats.find((b) => b.phase === 'read'), [sc]);
  const firstDoor = useMemo(() => sc?.beats.find((b) => b.phase === 'door'), [sc]);

  const addCue = useCallback((lane: keyof Lanes, cues: Cue[]) => { const now = clock.current.time; lanes.current[lane] = [...lanes.current[lane].filter((c) => c.end > now && c.start < now), ...cues].sort((a, b) => a.start - b.start); }, []);
  const stopLength = useCallback((i: number) => { if (!sc) return 12; const s = sc.stops[i]!; const next = sc.stops[i + 1]?.t ?? returnBeat?.t ?? s.t + 12; return next - s.t; }, [sc, returnBeat]);

  /** Enters a stop. The narrator lane carries the stop text, the archive clip starts on the J cut, and the world source cuts to the stop's surface. */
  const enterStop = useCallback((i: number) => {
    if (!sc) return; const s: Stop = sc.stops[i]!; setStop(i); stopEnteredAt.current = clock.current.time;
    const spoken = s.voice && sc.audio[s.voice] ? audio.current?.playVoice(s.voice, clock.current, s.t) : false;
    addCue('narrator', cuesFromText(s.text, s.t, s.t + Math.min(11, stopLength(i) - 1)));
    if (!spoken && s.audio) audio.current?.play(s.audio, s.t + stopLength(i) - 0.3);
    void world.current?.cut(s).then((v) => setVideo(v)); void world.current?.advance(s.label);
  }, [sc, setStop, addCue, stopLength]);

  const openWorld = useCallback(() => {
    if (!sc) return; const attach = (v: HTMLVideoElement) => audio.current?.attachWorldVideo(v);
    const src: WorldSource = new URLSearchParams(location.search).get('live') === '0' ? new FallbackSource(sc.world.video ?? null, attach) : new LiveReactorSource(attach);
    world.current = src; void src.open(sc.world.seed ?? '').then((v) => setVideo(v));
  }, [sc]);

  const schedule = useMemo(() => {
    if (!sc) return [] as { t: number; run: () => void }[]; const ev: { t: number; run: () => void }[] = [];
    const lead = (t: number) => Math.max(0, t - AUDIO_LEAD);
    for (const b of sc.beats) {
      if (b.voice) { const v = b.voice; ev.push({ t: v.at ?? b.t, run: () => { const at = v.at ?? b.t; const spoken = sc.audio[v.id] ? audio.current?.playVoice(v.id, clock.current, at) : false; addCue('narrator', cuesFromText(v.text, at, at + (v.dur ?? (spoken ? 8 : 6)))); } }); }
      if (b.caption) { const c = b.caption; ev.push({ t: b.t, run: () => addCue(c.kind === 'voice' ? 'narrator' : 'dialogue', cuesFromText(c.text, b.t, b.t + (c.dur || 6), c.speaker)) }); }
      for (const a of b.archive ?? []) ev.push({ t: a.at ?? lead(b.t), run: () => audio.current?.play(a.id, a.until ?? b.t + 10) });
      for (const f of b.foley ?? []) ev.push({ t: f.at != null ? f.at : lead(b.t), run: () => audio.current?.foley(f.id, f.pan ?? 0, f.until, clock.current.time) });
      if (b.objective) ev.push({ t: b.objective.at, run: () => setObjective(true) });
      if (b.wire) { const w = b.wire; ev.push({ t: b.t, run: () => setWire({ ...w, until: b.t + w.dur }) }); }
      if (b.resolved) ev.push({ t: b.t, run: () => resolveMark(sc.readPage) });
      if (b.translate !== undefined) { const key = b.translate; ev.push({ t: b.t + (b.camera ? Math.min(1.2, (b.camera.dur ?? 2) * 0.5) : 0), run: () => setTranslateKey(key) }); }
    }
    if (firstRead) ev.push({ t: lead(firstRead.t), run: () => audio.current?.readDroneOn() });
    if (firstDoor) ev.push({ t: lead(firstDoor.t), run: () => audio.current?.readDroneOff() });
    if (worldBeat) {
      ev.push({ t: worldBeat.t - 2, run: openWorld });
      ev.push({ t: worldBeat.t - RISER_LENGTH, run: () => audio.current?.riserFor(worldBeat.t - AUDIO_LEAD - clock.current.time) });
      ev.push({ t: lead(worldBeat.t), run: () => audio.current?.worldOn(worldBeat.world?.dur ?? 2) });
    }
    if (returnBeat) ev.push({ t: returnBeat.t, run: () => { audio.current?.worldOff(); setObjective(false); setTimeout(() => { world.current?.close(); world.current = null; setVideo(null); }, RETURN_TAIL * 1000); } });
    sc.stops.forEach((_, i) => ev.push({ t: lead(sc.stops[i]!.t), run: () => enterStop(i) }));
    return ev.sort((a, b) => a.t - b.t);
  }, [sc, resolveMark, addCue, enterStop, openWorld, firstRead, firstDoor, worldBeat, returnBeat]);

  /** Begins the sequence. Audio starts on this gesture and every clip is registered on its bus. */
  const begin = useCallback(async () => {
    if (!sc || !ready) return;
    if (!audio.current) audio.current = new AudioGraph();
    const g = audio.current; await g.start();
    const voiceIds = new Set<string>(); sc.beats.forEach((b) => b.voice && voiceIds.add(b.voice.id)); sc.stops.forEach((s) => voiceIds.add(s.voice));
    for (const [id, clip] of Object.entries(sc.audio)) g.register(id, { src: resolveClip('/', clipSrc(clip)), bus: voiceIds.has(id) ? 'voice' : 'archive', start: clipStart(clip) });
    clock.current.reset(0); fired.current.clear(); lanes.current = { dialogue: [], narrator: [] }; setRunning(true); setPaused(false);
    if (START_AT > 0) seekRef.current?.(START_AT);
  }, [sc, ready]);

  /** Seeks both the clock and the voice. Events before the target count as fired and the audio is brought to the phase at the target. */
  const seek = useCallback((t: number) => {
    if (!sc) return; const target = Math.max(0, Math.min(t, sc.beats[sc.beats.length - 1]!.t + 3));
    clock.current.seek(target); fired.current.clear(); schedule.forEach((e, i) => { if (e.t < target) fired.current.add(i); });
    lanes.current = { dialogue: [], narrator: [] }; audio.current?.stopCurrent(0.2); audio.current?.cancelRiser(); smoothedY.current = null;
    const ph = phaseAt(sc, target); setPhase(ph);
    if (ph === 'world') { const i = sc.stops.findIndex((s, k) => target >= s.t - AUDIO_LEAD && (k === sc.stops.length - 1 || target < sc.stops[k + 1]!.t - AUDIO_LEAD)); if (!world.current) openWorld(); audio.current?.worldOn(0.5); if (i >= 0) enterStop(i); }
    else { if (world.current) { world.current.close(); world.current = null; setVideo(null); } audio.current?.worldOff(); }
    if (ph === 'read' || ph === 'ghost') audio.current?.readDroneOn(); else audio.current?.readDroneOff();
    if (ph !== 'world') setObjective(false);
  }, [sc, schedule, setPhase, openWorld, enterStop]);

  seekRef.current = seek;
  const advanceStop = useCallback(() => { if (!sc || phase !== 'world') return; const t = clock.current.time; const next = sc.stops.find((s) => s.t - AUDIO_LEAD > t + 0.01); if (next) seek(next.t - AUDIO_LEAD); else if (returnBeat) seek(returnBeat.t); }, [sc, phase, seek, returnBeat]);
  const togglePause = useCallback(() => { setPaused((p) => { const next = !p; clock.current.paused = next; if (next) audio.current?.pause(); else audio.current?.resume(clock.current.voiceElement); return next; }); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') { e.preventDefault(); if (running) togglePause(); }
      if (e.key === 'ArrowRight' && running) { e.preventDefault(); seek(clock.current.time + SCRUB_STEP); }
      if (e.key === 'ArrowLeft' && running) { e.preventDefault(); seek(clock.current.time - SCRUB_STEP); }
      if (e.key === 'Enter' && running) advanceStop();
      if (e.key === 'Escape' && view === 'hub') toCatalogue();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [running, view, togglePause, seek, advanceStop, toCatalogue]);

  const onTick = useCallback((dt: number) => {
    if (!sc || !sample) { force((n) => n + 1); return; }
    const c = clock.current; if (running) c.tick(dt); const t = c.time;
    if (running) {
      schedule.forEach((e, i) => { if (!fired.current.has(i) && e.t <= t) { fired.current.add(i); if (t - e.t < 1.5) e.run(); } });
      const ph = phaseAt(sc, t); if (ph !== phase) setPhase(ph);
      if (wire && t > wire.until) setWire(null);
      audio.current?.setBed(provenanceVisible ? 0 : sample('bed', t));
      if (t > sc.beats[sc.beats.length - 1]!.t + 3.5) { setRunning(false); audio.current?.stopCurrent(); lanes.current = { dialogue: [], narrator: [] }; }
    }
    audio.current?.tick(dt, t);
    force((n) => n + 1);
  }, [sc, sample, schedule, phase, setPhase, wire, provenanceVisible, running]);

  const inCatalogue = view === 'catalogue';
  const t = clock.current.time; const prov = provenanceVisible; const now = performance.now() / 1000;
  const veilOpacity = Math.max(veil.current.valueAt(now), sc ? veilAt(windows, running ? t : -100, reducedMotion) : 0);

  let stage: JSX.Element | null = null;
  if (sc && sample && loaded) {
    const { align, lines } = loaded; const page = sc.pages[sc.readPage]!; const opts = { reducedMotion };
    const cur = running ? align.find((a) => t >= a.start && t < a.end) : undefined; const lastAl = running ? [...align].reverse().find((a) => a.start <= t) : undefined;
    const beat: Beat | undefined = beatAt(sc, t); const nextBeat = sc.beats.find((b) => b.t > t);
    const tracking = running && !!beat && (beat.track || beat.drift) && (!nextBeat || t < nextBeat.t);
    const ref = cur ?? lastAl; const trackY = tracking && ref && ref.page === sc.readPage ? page.y + (ref.w.y + ref.w.height / 2) * page.h + 2 * sc.lineHeight * page.h : null;
    const base = trackY != null && smoothedY.current != null ? { t, v: smoothedY.current } : undefined;
    const camX = tracking && beat?.drift ? page.x + sc.columnX * page.w : sample('camera.x', t, opts);
    const cam = { x: camX, y: sample('camera.y', t, { ...opts, base }), z: sample('camera.z', t, opts), trackY };
    const focusPage = ref && tracking ? sc.pages[ref.page]! : null;
    const focus = { x: focusPage && ref ? focusPage.x + (ref.w.x + ref.w.width / 2) * focusPage.w : sample('focus.x', t, opts), y: focusPage && ref ? focusPage.y + (ref.w.y + ref.w.height / 2) * focusPage.h : sample('focus.y', t, opts), radius: sample('focus.radius', t, opts) };
    const mix = prov ? 0 : sample('world.mix', t, opts);
    const s = window.innerHeight / (2 * Math.tan((FOV * Math.PI) / 360)) / cam.z; const camY = base ? base.v : cam.y;
    const proj = (u: number, v: number): [number, number] => [window.innerWidth / 2 + (u - cam.x) * s, window.innerHeight / 2 + (v - camY) * s];
    const slideX = (id: string) => { const p = sc.pages[id]!; return p.slideFrom != null ? p.slideFrom + (p.x - p.slideFrom) * sample('plane.' + id + '.slide', t, opts) : p.x; };
    const focusNdc = proj(focus.x, focus.y);
    const marks: ProjectedMark[] = sc.marks.map((m) => { const p = sc.pages[m.page]!; const px = slideX(m.page); const [x0, y0] = proj(px + m.x * p.w, p.y + m.y * p.h); const [x1, y1] = proj(px + (m.x + m.w) * p.w, p.y + (m.y + m.h) * p.h); return { label: m.label, source: m.source, x: x0, y: y0, w: x1 - x0, h: y1 - y0, outline: m.outline, visible: !m.provenanceOnly && running && m.from != null && t >= m.from && phase !== 'hub' && phase !== 'world' && sample('plane.' + m.page + '.o', t, opts) > 0.5 }; });
    const lb = sample('letterbox', t, opts);
    const readLine = cur?.driftLine != null ? sc.readLines?.[Math.min((sc.readLines?.length ?? 1) - 1, Math.floor((cur.driftLine / align.length) * (sc.readLines?.length ?? 1)))] : cur?.w.line != null ? lines[sc.readPage]?.[cur.w.line]?.text : undefined;
    const dialogue = cueAt(lanes.current.dialogue, t); const narrator = cueAt(lanes.current.narrator, t);
    const dialogueCue = dialogue ? { text: dialogue.text, speaker: dialogue.speaker, kind: 'archive' as const } : readLine ? { text: readLine, kind: 'read' as const } : null;
    const hubPages = Object.entries(sc.pages).filter(([, p]) => p.hub); const hubBottom = Math.max(...hubPages.map(([, p]) => p.y + p.h));
    const labels: HubLabel[] = hubPages.map(([id, p]) => { const [x, y] = proj(p.x + p.w / 2, hubBottom); return { id, title: p.short ?? p.label, x, y, visible: phase === 'hub' && sample('plane.' + id + '.o', t, opts) > 0.5, resolved: resolvedMarks.includes(id) }; });
    const prompt = proj((Math.min(...hubPages.map(([, p]) => p.x)) + Math.max(...hubPages.map(([, p]) => p.x + p.w))) / 2, hubBottom);
    const stop = stopIndex >= 0 ? sc.stops[stopIndex] : undefined; const stopAge = stop ? t - stopEnteredAt.current : 0;
    const surface = stop?.surface ?? (sc.world.animate === 'tv' ? 'tv' : 'film');
    const photo = beat?.photo && (phase === 'door' || phase === 'memo') && !prov ? beat.photo : null;
    const tr = translateKey && sc.translations?.[translateKey]; const trPage = translateKey === 'caption11' && sc.pages.B02 ? 'B02' : sc.readPage;
    const trRect = tr ? (() => { const p = sc.pages[trPage]!; const px = slideX(trPage); const [x0, y0] = proj(px + tr.x * p.w, p.y + tr.y * p.h); const [x1, y1] = proj(px + (tr.x + tr.w) * p.w, p.y + (tr.y + tr.h) * p.h); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; })() : null;
    const ghostSrc = beat?.ghost?.src ?? sc.ghost.src; const ghostScale = sample('ghost.scale', t, opts); const ghostOpacity = sample('ghost.opacity', t, opts);
    const grain = reducedMotion ? 0 : prov ? 0.04 : sample('post.grain', t, opts);
    const warmth = prov ? 0 : sample('warmth', t, opts) * (surface === 'tv' ? 1 - 0.75 * mix : 1);

    stage = (
      <>
        <Canvas dpr={[1, 2]} gl={{ alpha: false, antialias: false }} style={{ position: 'fixed', inset: 0, opacity: inCatalogue ? 0 : 1 }} onCreated={({ gl }) => gl.setClearColor(0x0b0b0a, 1)}>
          <Ticker onTick={onTick} />
          <CameraRig target={cam} time={t} reducedMotion={reducedMotion} onSmoothed={(y) => { smoothedY.current = y; }} />
          <Suspense fallback={null}>
            {Object.entries(sc.pages).map(([id, p]) => <PagePlane key={id} src={'/' + p.src} x={slideX(id)} y={p.y} w={p.w} h={p.h} opacity={sample('plane.' + id + '.o', t, opts)} visible={id !== sc.readPage} />)}
            <HighlightPlane src={'/' + page.src} x={page.x} y={page.y} w={page.w} h={page.h} opacity={sample('plane.' + sc.readPage + '.o', t, opts)} box={cur && cur.page === sc.readPage && !prov ? [cur.w.x, cur.w.y, cur.w.width, cur.w.height] : [0, 0, 0, 0]} strength={cur ? 1 : 0} desat={sample('desat', t, opts)} marks={sc.marks.filter((m) => m.page === sc.readPage && (prov || (m.from != null && t >= m.from))).map((m) => [m.x, m.y, m.w, m.h])} provenance={prov} />
            {photo && <PhotoPlane src={'/' + sc.pages[photo.page]!.src} x={slideX(photo.page) + photo.x * sc.pages[photo.page]!.w} y={sc.pages[photo.page]!.y + photo.y * sc.pages[photo.page]!.h} w={photo.w * sc.pages[photo.page]!.w} h={photo.h * sc.pages[photo.page]!.h} crop={[photo.x, photo.y, photo.w, photo.h]} age={beat ? t - beat.t : 0} visible reducedMotion={reducedMotion} />}
            <GhostPlane src={'/' + ghostSrc} x={page.x + sc.ghost.x * page.w} y={page.y + sc.ghost.y * page.w} w={sc.ghost.w * page.w} h={sc.ghost.h * page.w} opacity={ghostOpacity} scale={ghostScale} visible={!prov} />
            <WorldPlane video={video} seedUrl={sc.world.seed ? '/' + sc.world.seed : null} mix={mix} cell={dotCell(cam.z)} surface={surface} stopAge={stopAge} stopLength={stop ? stopLength(stopIndex) : 12} visible={!prov} reducedMotion={reducedMotion} />
          </Suspense>
          <Effects grain={grain} vignette={prov ? 0.15 : sample('post.vignette', t, opts)} aberration={prov ? 0 : sample('post.aberration', t, opts)} warmth={warmth} focus={{ cx: focusNdc[0] / window.innerWidth, cy: 1 - focusNdc[1] / window.innerHeight, radius: focus.radius * 0.5, enabled: !prov && mix < 0.5 && focus.radius < 0.98 }} />
        </Canvas>
        {!inCatalogue && (
          <>
            <Translation box={tr || null} rect={trRect} visible={!!tr && !prov} scale={sc.pages[trPage]!.w * s} />
            <Veil opacity={veilOpacity} />
            <Letterbox amount={lb} />
            <Subtitles dialogue={dialogueCue} narrator={narrator ? { text: narrator.text, kind: 'voice' } : null} letterbox={lb} reducedMotion={reducedMotion} />
            <ObjectiveCard text={sc.world.objective} visible={objective && phase === 'world'} resolved={stopIndex === sc.stops.length - 1} letterbox={lb} />
            <WireCard time={wire?.time ?? ''} agency={wire?.agency ?? ''} text={wire?.text ?? ''} visible={!!wire} />
            <Provenance marks={marks} />
            <Hub sc={sc} labels={labels} ready={ready} running={running} prompt={prompt} onBegin={() => void begin()} onCatalogue={toCatalogue} reducedMotion={reducedMotion} />
            <div className="ui pointer-events-none fixed bottom-[18px] left-8 flex gap-4"><span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>{Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}{paused ? '  paused' : ''}</span><span style={{ opacity: 0.45 }}>{phase}{phase === 'world' && stop ? '  ·  ' + stop.label : ''}</span></div>
            <div className="ui pointer-events-none fixed bottom-[18px] right-8 flex gap-4" style={{ opacity: 0.35 }}><span>space pause</span><span>arrows scrub</span><span>p provenance</span>{phase === 'world' && <span>enter or click, next stop</span>}</div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0" style={{ background: '#0b0b0a' }} onClick={advanceStop}>
      {stage}
      {!sc && !inCatalogue && <div className="ui fixed inset-0 grid place-items-center">Loading</div>}
      <Catalogue clusters={clusters} visible={inCatalogue} onOpen={(id) => void choose(id)} reducedMotion={reducedMotion} />
    </div>
  );
}
