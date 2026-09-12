import { loadScenario } from '../data/scenario';
import { WorldOrchestrator } from './WorldOrchestrator';
import { moveToPose } from './CameraRail';

/**
 * The in page half of the pre-render. Opened with ?prerender=1&event=<id>, it mounts only the
 * world surface at the recording size, runs the live source through every stop on a timer, and
 * reports the entry time of each stop on window.__atlasPrerender so the script can write the
 * fallback offsets back into the scenario. When the live model is unreachable the seed source
 * plays the same stops, so the recorded film still lands each picture at the right second.
 */
export interface PrerenderReport { entries: number[]; sources: string[]; done: boolean; error: string | null; reason: string | null }

declare global { interface Window { __atlasPrerender?: PrerenderReport } }

export async function runPrerender(params: URLSearchParams) {
  const event = params.get('event') ?? 'apollo11';
  const report: PrerenderReport = { entries: [], sources: [], done: false, error: null, reason: null };
  window.__atlasPrerender = report;
  document.body.style.background = '#000';
  try {
    const sc = await loadScenario('/scenarios/' + event + '.json');
    const orch = new WorldOrchestrator(sc, { now: () => 0, mode: params.get('mode') === 'seed' ? 'seed' : 'prerender' });
    orch.surface.style.position = 'fixed'; orch.surface.style.inset = '0';
    document.body.append(orch.surface);
    await orch.door();
    orch.world(); orch.setMix(1);
    const stops = sc.world.stops;
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i]!;
      await orch.enterStop(i);
      report.entries.push(performance.now()); report.sources.push(orch.getState().source ?? 'none'); report.reason = orch.getState().reason;
      const next = stops[i + 1];
      const rail = stop.camera.reduce((a, m) => a + moveToPose(m).seconds, 0);
      const seconds = next ? next.t - stop.t : Math.max(stop.hold ?? 0, rail) + 2;
      await new Promise((r) => setTimeout(r, seconds * 1000));
    }
    await orch.leave();
    orch.setMix(0);
  } catch (e) { report.error = e instanceof Error ? e.message : String(e); }
  report.done = true;
}
