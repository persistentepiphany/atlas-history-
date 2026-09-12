import raw from '../../reactor.config.json';

/** Runtime defaults for the world layer. Every number here comes from reactor.config.json and nowhere else. */
export interface ReactorConfig {
  defaultModel: string;
  firstFrameTimeoutMs: number;
  stopCrossfadeMs: number;
  audioLeadMs: number;
  maxLookOffset: number;
  preferFallback: boolean;
  returnTailMs: number;
  liveCleanRunsRequired: number;
}
export const reactorConfig: ReactorConfig = raw;

const CLEAN_RUNS_KEY = 'atlas.world.cleanLiveRuns';

/** How many visits have played through the live model without a swap. */
export function cleanLiveRuns(): number {
  try { return Number(localStorage.getItem(CLEAN_RUNS_KEY)) || 0; } catch { return 0; }
}
export function recordCleanLiveRun(): number {
  const n = cleanLiveRuns() + 1;
  try { localStorage.setItem(CLEAN_RUNS_KEY, String(n)); } catch { /* a private window keeps no count */ }
  return n;
}
/** The recorded film leads until the live path has run clean the required number of times. */
export function liveIsTrusted(): boolean { return !reactorConfig.preferFallback || cleanLiveRuns() >= reactorConfig.liveCleanRunsRequired; }

/** Resolves a path from a scenario's world block. Paths that already start at the asset root or at a scheme are kept, anything else is relative to the event's asset folder. */
export function worldAsset(eventId: string, path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  if (path.startsWith('assets/')) return '/' + path;
  return '/assets/' + eventId + '/' + path;
}
