import type { Treatment } from '../data/types';

/**
 * The grade applied to the world surface. tv is grey with scanlines and a dim tube, film is
 * warm grain with no lines, flash is hard contrast with a slight vignette for the Berlin flash
 * photographs, none leaves the picture untouched. The value is read from world.treatment in the
 * scenario, so a new event never needs a branch here.
 */
export interface Grade { filter: string; scanlines: number; grain: number; vignette: number }

export const GRADES: Record<Treatment, Grade> = {
  tv: { filter: 'grayscale(1) brightness(0.55) contrast(1.1)', scanlines: 0.6, grain: 0.08, vignette: 0.25 },
  film: { filter: 'sepia(0.28) saturate(1.15) contrast(1.02)', scanlines: 0, grain: 0.25, vignette: 0.12 },
  flash: { filter: 'contrast(1.45) brightness(0.92) saturate(0.7)', scanlines: 0, grain: 0.05, vignette: 0.32 },
  none: { filter: 'none', scanlines: 0, grain: 0, vignette: 0 },
};

export function applyTreatment(surface: HTMLElement, treatment: Treatment) {
  const g = GRADES[treatment];
  surface.dataset.treatment = treatment;
  surface.style.setProperty('--world-filter', g.filter);
  surface.style.setProperty('--world-scanlines', String(g.scanlines));
  surface.style.setProperty('--world-grain', String(g.grain));
  surface.style.setProperty('--world-vignette', String(g.vignette));
}
