import { z } from 'zod';

export const Phase = z.enum(['hub', 'select', 'read', 'ghost', 'door', 'world', 'return', 'memo', 'end']);
export type Phase = z.infer<typeof Phase>;

export const Asset = z.object({
  id: z.string(), path: z.string(), medium: z.string(), source: z.string(), source_url: z.string().optional(),
  fetched: z.string(), fetch_method: z.string(), rights: z.string(), processing: z.string(),
  layer: z.enum(['deterministic', 'generated', 'synthetic']),
});
export type Asset = z.infer<typeof Asset>;
export const Manifest = z.object({ event: z.string(), assets: z.array(Asset) });
export type Manifest = z.infer<typeof Manifest>;

const Move = z.object({ dur: z.number().optional(), at: z.number().optional() });
export const Page = z.object({
  src: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), short: z.string().optional(),
  source: z.string(), layer: z.string(), words: z.string().optional(), lines: z.string().optional(),
  syntheticLines: z.object({ x: z.number(), w: z.number(), y0: z.number(), y1: z.number(), count: z.number() }).optional(),
  hub: z.boolean().optional(), selectable: z.boolean().optional(), placeholder: z.boolean().optional(), memo: z.boolean().optional(), slideFrom: z.number().optional(),
}).passthrough();
export type Page = z.infer<typeof Page>;

export const Beat = z.object({
  t: z.number(), phase: Phase, track: z.boolean().optional(), drift: z.boolean().optional(),
  camera: Move.extend({ x: z.number().optional(), y: z.number().optional(), z: z.number().optional() }).optional(),
  focus: Move.extend({ x: z.number().optional(), y: z.number().optional(), radius: z.number().optional() }).optional(),
  post: Move.extend({ grain: z.number().optional(), vignette: z.number().optional(), aberration: z.number().optional() }).optional(),
  warmth: Move.extend({ v: z.number() }).optional(), letterbox: Move.extend({ v: z.number() }).optional(),
  desat: Move.extend({ v: z.number() }).optional(), bed: Move.extend({ v: z.number() }).optional(),
  ghost: Move.extend({ opacity: z.number().optional(), scale: z.number().optional(), src: z.string().optional() }).optional(),
  world: Move.extend({ mix: z.number() }).optional(),
  planes: z.record(Move.extend({ o: z.number().optional(), slide: z.number().optional() })).optional(),
  foley: z.array(z.object({ id: z.string(), at: z.number().optional(), until: z.number().optional() })).optional(),
  archive: z.array(z.object({ id: z.string(), at: z.number().optional(), until: z.number().optional() })).optional(),
  voice: z.object({ id: z.string(), text: z.string(), at: z.number().optional(), dur: z.number().optional() }).optional(),
  caption: z.object({ text: z.string(), kind: z.string(), dur: z.number().optional() }).nullable().optional(),
  wire: z.object({ time: z.string(), agency: z.string(), text: z.string(), dur: z.number() }).optional(),
  objective: z.object({ at: z.number() }).optional(), resolved: z.boolean().optional(),
  photo: z.unknown().optional(), translate: z.string().nullable().optional(),
}).passthrough();
export type Beat = z.infer<typeof Beat>;

/** One scripted camera move on the world rail. Values are fractions of the model's own unit per move, played in order from stop entry. */
export const CameraMove = z.union([
  z.object({ dolly: z.number(), seconds: z.number() }),
  z.object({ pan: z.number(), seconds: z.number() }),
  z.object({ tilt: z.number(), seconds: z.number() }),
  z.object({ orbit: z.number(), seconds: z.number() }),
  z.object({ hold: z.number() }),
]);
export type CameraMove = z.infer<typeof CameraMove>;

/** A seed is a scenario relative image path, or an instruction to reuse the last frame of the previous stop. */
export const Seed = z.union([z.string(), z.object({ fromPreviousFrame: z.literal(true) })]);
export type Seed = z.infer<typeof Seed>;

export const Stop = z.object({
  t: z.number(), label: z.string(),
  seed: Seed, prompt: z.string(), negative: z.string().optional(),
  camera: z.array(CameraMove),
  hold: z.number().optional(), archive: z.string().optional(), voice: z.string().optional(), captureFrame: z.boolean().optional(),
  text: z.string().optional(),
});
export type Stop = z.infer<typeof Stop>;

export const Treatment = z.enum(['tv', 'film', 'flash', 'none']);
export type Treatment = z.infer<typeof Treatment>;

export const WorldConfig = z.object({
  model: z.string().optional(),
  fallback: z.string(),
  fallbackOffsets: z.array(z.number()).optional(),
  objective: z.string(),
  treatment: Treatment,
  label: z.string().optional(), source: z.string().optional(), layer: z.string().optional(),
  stops: z.array(Stop),
});
export type WorldConfig = z.infer<typeof WorldConfig>;

export const Mark = z.object({ page: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), source: z.string(), from: z.number().optional(), provenanceOnly: z.boolean().optional(), outline: z.boolean().optional() });

export const AudioEntry = z.union([z.string(), z.object({ src: z.string(), start: z.number().optional(), label: z.string().optional(), source: z.string().optional() })]);
export type AudioEntry = z.infer<typeof AudioEntry>;
export const audioSrc = (e: AudioEntry) => (typeof e === 'string' ? e : e.src);

export const Scenario = z.object({
  id: z.string(), title: z.string(), date: z.string(), readPage: z.string(), columnX: z.number(), lineHeight: z.number(),
  pages: z.record(Page),
  ghost: z.object({ src: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), source: z.string(), layer: z.string() }),
  world: WorldConfig,
  hubCamera: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  marks: z.array(Mark), align: z.record(z.any()), audio: z.record(AudioEntry), readLines: z.array(z.string()).optional(), readLinesEn: z.array(z.string()).optional(),
  translations: z.record(z.any()).optional(),
  beats: z.array(Beat),
});
export type Scenario = z.infer<typeof Scenario>;

export interface Cluster { id: string; label: string; date: string; pages: { id: string; title: string; thumb: string }[]; eventId?: string }
export interface WordBox { w: string; x: number; y: number; width: number; height: number; conf: number; line?: number }
export interface AlignedWord { w: string; start: number; end: number }
