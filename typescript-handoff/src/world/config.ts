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
}
export const reactorConfig: ReactorConfig = raw;

/** Resolves a path from a scenario's world block. Paths that already start at the asset root or at a scheme are kept, anything else is relative to the event's asset folder. */
export function worldAsset(eventId: string, path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  if (path.startsWith('assets/')) return '/' + path;
  return '/assets/' + eventId + '/' + path;
}
