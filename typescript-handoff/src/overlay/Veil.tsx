import { VEIL_COLOUR } from '../sequence/transitions';
/** The near black pass between phases. It sits under the letterbox bars and above the picture. */
export function Veil({ opacity }: { opacity: number }) {
  return <div className="pointer-events-none fixed inset-0" style={{ background: VEIL_COLOUR, opacity, willChange: 'opacity' }} aria-hidden />;
}
