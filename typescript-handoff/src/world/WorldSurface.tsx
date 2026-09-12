import { useEffect, useRef, useState } from 'react';
import type { WorldOrchestrator, OrchestratorState } from './WorldOrchestrator';

/**
 * Mounts the orchestrator's surface in the DOM layer above the canvas and shows the provenance
 * mark for the generated world, the captured last frame with its source and model, when the
 * provenance key is held. Under provenance the generated picture itself is hidden.
 */
export function WorldSurface({ orch, provenance, model }: { orch: WorldOrchestrator | null; provenance: boolean; model: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<OrchestratorState | null>(null);
  useEffect(() => {
    if (!orch || !host.current) { setState(null); return; }
    host.current.append(orch.surface); setState(orch.getState());
    const off = orch.subscribe(setState);
    return () => { off(); orch.surface.remove(); };
  }, [orch]);
  return (
    <>
      <div ref={host} className="pointer-events-none fixed inset-0" style={{ visibility: provenance ? 'hidden' : 'visible' }} />
      {provenance && state?.lastFrame && (
        <div className="ui pointer-events-none fixed right-8 bottom-[56px] flex flex-col items-end gap-1" style={{ maxWidth: '34ch', textAlign: 'right' }}>
          <img src={state.lastFrame} alt="" style={{ width: 200, border: '1px solid rgba(235,230,220,0.4)', filter: 'grayscale(1)', opacity: 0.85 }} />
          <span>Generated world, {state.source ?? 'no source'}</span>
          <span style={{ opacity: 0.5 }}>{state.source === 'live' ? model : state.source === 'fallback' ? 'pre-rendered from ' + model : 'seed still'}</span>
        </div>
      )}
    </>
  );
}
