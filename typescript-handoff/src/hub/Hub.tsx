import { motion } from 'framer-motion';
import type { Scenario } from '../data/types';

export interface HubLabel { id: string; title: string; x: number; y: number; visible: boolean; resolved: boolean }

/**
 * The hub is drawn by the same camera as the sequence at z 7, so the handoff into the read is a
 * camera move rather than a viewer crossfade. Labels live in the DOM under each page and the
 * begin prompt appears only once every asset of the sequence is in cache.
 */
export function Hub({ sc, labels, ready, running, prompt, onBegin, onCatalogue, reducedMotion }: { sc: Scenario; labels: HubLabel[]; ready: boolean; running: boolean; prompt: [number, number]; onBegin: () => void; onCatalogue: () => void; reducedMotion: boolean }) {
  const fade = reducedMotion ? 0.2 : 1.2;
  return (
    <div className="pointer-events-none fixed inset-0 ui">
      {labels.map((l) => (
        <div key={l.id} className="absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap" style={{ transform: 'translate(-50%, 0) translate(' + l.x + 'px,' + (l.y + 12) + 'px)', opacity: l.visible ? 1 : 0, transition: 'opacity ' + fade + 's' }}>
          <span>{l.title}</span>
          {l.resolved && <span style={{ color: 'rgba(255,178,86,0.85)' }}>Resolved</span>}
        </div>
      ))}
      <motion.button className="absolute left-0 top-0 whitespace-nowrap ui" style={{ transform: 'translate(-50%, 0) translate(' + prompt[0] + 'px,' + (prompt[1] + 56) + 'px)', background: 'none', border: 0, color: 'rgba(235,230,220,0.5)', pointerEvents: ready && !running ? 'auto' : 'none', cursor: 'pointer' }}
        animate={{ opacity: running ? 0 : 1 }} transition={{ duration: fade }} onClick={(e) => { e.stopPropagation(); if (ready) onBegin(); }} aria-disabled={!ready}>
        {ready ? 'Click the page to begin' : 'Loading the pages'}
      </motion.button>
      <motion.div className="absolute left-8 top-6 flex flex-col gap-3.5" animate={{ opacity: running ? 0 : 1 }} transition={{ duration: fade }} style={{ pointerEvents: running ? 'none' : 'auto' }}>
        <div className="flex items-baseline gap-5">
          <button className="ui" onClick={(e) => { e.stopPropagation(); onCatalogue(); }} style={{ background: 'none', border: 0, padding: '4px 0', opacity: 0.45, cursor: 'pointer' }}>Catalogue</button>
          <span>{sc.title}</span>
        </div>
        <span style={{ opacity: 0.45 }}>{sc.date}</span>
      </motion.div>
    </div>
  );
}
