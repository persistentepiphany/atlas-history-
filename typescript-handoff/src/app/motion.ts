import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean { return typeof matchMedia === 'function' && matchMedia(QUERY).matches; }

/** Tracks the reduced motion preference. Drift and grain switch off and every ease shortens to 200 ms while it holds. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(QUERY); const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange); return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
