import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { wrapLines } from '../subtitles/chunk';

export interface LaneCue { text: string; speaker?: string; kind: 'voice' | 'archive' | 'read' }

/** Holds the last cue while it fades out, then swaps and fades the next one in. Independent of how often the parent renders. */
function FadingLane({ cue, fade, style, render }: { cue: LaneCue | null; fade: number; style: CSSProperties; render: (c: LaneCue) => ReactNode }) {
  const [shown, setShown] = useState<LaneCue | null>(cue); const [visible, setVisible] = useState(!!cue);
  const pending = useRef<LaneCue | null>(cue); const timer = useRef<number | null>(null);
  const key = cue ? cue.text + ' ' + (cue.speaker ?? '') : '';
  const shownKey = shown ? shown.text + ' ' + (shown.speaker ?? '') : '';
  useEffect(() => {
    pending.current = cue;
    if (key === shownKey) { if (cue && !visible) setVisible(true); return; }
    setVisible(false);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setShown(pending.current); setVisible(!!pending.current); timer.current = null; }, shown ? fade * 1000 : 0);
    return () => { if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; } };
  }, [key, shownKey, cue, shown, visible, fade]);
  return <div style={{ ...style, opacity: visible ? 1 : 0, transition: 'opacity ' + fade + 's cubic-bezier(0.65,0,0.35,1)' }}>{shown ? render(shown) : null}</div>;
}

/**
 * Two lanes. The dialogue lane sits bottom centre inside the lower bar and carries archive
 * speech and column reads. The narrator lane sits bottom left and never crosses into the
 * dialogue lane. On a narrow viewport the narrator lane lifts above the dialogue lane.
 */
export function Subtitles({ dialogue, narrator, letterbox, reducedMotion }: { dialogue: LaneCue | null; narrator: LaneCue | null; letterbox: number; reducedMotion: boolean }) {
  const lb = letterbox * 12; const inBar = lb > 0.6;
  const dialogueBottom = inBar ? 'calc(' + lb / 2 + 'vh - 1.6em)' : 'calc(' + lb + 'vh + 28px)';
  const narrow = typeof window !== 'undefined' && window.innerWidth < 1080;
  const narratorBottom = narrow && dialogue ? 'calc(' + lb + 'vh + 88px)' : dialogueBottom;
  const fade = reducedMotion ? 0.2 : 0.6;
  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 flex justify-center ui" style={{ bottom: dialogueBottom }} aria-live="polite">
        <FadingLane cue={dialogue} fade={fade} style={{ maxWidth: '44ch', textAlign: 'center', lineHeight: 1.55 }} render={(c) => (
          <div style={{ fontStyle: c.kind === 'archive' ? 'italic' : 'normal', opacity: c.kind === 'archive' ? 0.62 : 0.8 }}>
            {c.speaker && <div style={{ fontVariant: 'small-caps', fontStyle: 'normal', opacity: 0.55, letterSpacing: '0.12em' }}>{c.speaker.toLowerCase()}</div>}
            {wrapLines(c.text).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )} />
      </div>
      <div className="pointer-events-none fixed left-8 ui" style={{ bottom: narratorBottom, maxWidth: narrow ? '60vw' : 'calc(50vw - 22ch - 48px)' }} aria-live="polite">
        <FadingLane cue={narrator} fade={fade} style={{ lineHeight: 1.55, opacity: 0.78, textWrap: 'pretty' }} render={(c) => <>{c.text}</>} />
      </div>
    </>
  );
}
