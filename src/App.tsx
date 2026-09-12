import { PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react';

interface ArchiveInfo {
  title: string;
  sourceUrl: string;
  licence: string;
}

interface Cluster {
  id: string;
  date: string;
  label: string;
  country: string;
  thumb?: string;
  event?: string;
  pageCount?: number;
  archive?: ArchiveInfo;
}

interface Catalogue {
  countries: string[];
  decades: string[];
  clusters: Cluster[];
}

const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

const narration: Record<string, string> = {
  apollo11: 'July 21, 1969. Humanity wakes to a new world. A man has walked on the Moon, and the front page fixes that impossible distance in ink.',
  berlin1989: 'November 10, 1989. The border is open. Berliners move through the Wall as a divided city discovers, almost at once, that history has changed direction.',
  armistice1918: 'November 11, 1918. Germany accepts the armistice. The guns fall quiet, while newspapers carry the first uncertain words of peace across a wounded world.',
  titanic1912: 'April 16, 1912. The Titanic has struck an iceberg and gone beneath the Atlantic. Early reports reach the page in fragments, before the scale of the loss is known.',
  lindbergh1927: 'May 1927. Charles Lindbergh lands in Paris after crossing the Atlantic alone. The young pilot becomes, in a single night, the hero of the hour.',
  crash1929: 'October 30, 1929. Markets convulse after another day of selling. The columns record bank pressure, collapsing prices, and the first outline of a crisis still unfolding.',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

export function App() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [selected, setSelected] = useState<Cluster | null>(null);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    void fetch(publicUrl('catalogue.json')).then(async response => {
      if (!response.ok) throw new Error('Catalogue could not be loaded');
      setCatalogue(await response.json() as Catalogue);
    });
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalogue?.clusters.filter(item =>
      (!country || item.country === country) &&
      (!normalized || item.label.toLowerCase().includes(normalized) || item.date.includes(normalized)),
    ) ?? [];
  }, [catalogue, country, query]);

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const open = (item: Cluster) => {
    if (!item.thumb) return;
    setSelected(item);
    setPlaying(false);
    setProgress(0);
    resetView();
  };

  const close = () => {
    audioRef.current?.pause();
    setPlaying(false);
    setSelected(null);
  };

  const play = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    setScale(value => Math.max(value, 1.16));
    setPlaying(true);
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!selected) return;
      if (event.key === 'Escape') close();
      if (event.key === ' ') {
        event.preventDefault();
        void play();
      }
      if (event.key === '+' || event.key === '=') setScale(value => Math.min(3.5, value + 0.2));
      if (event.key === '-') setScale(value => Math.max(0.7, value - 0.2));
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [selected, playing]);

  const zoom = (amount: number) => setScale(value => Math.max(0.7, Math.min(3.5, value + amount)));
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.16 : -0.16);
  };
  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y });
  };

  if (!catalogue) return <main className="loading">Preparing the archive</main>;

  return (
    <main className="app">
      <section className={`catalogue ${selected ? 'catalogue--behind' : ''}`} aria-hidden={!!selected}>
        <header className="masthead">
          <div>
            <p className="eyebrow">An archive of decisive mornings</p>
            <h1>Front Pages</h1>
          </div>
          <p className="introduction">Read the paper first. Then let the page begin to speak.</p>
        </header>

        <div className="filters">
          <label>
            <span>Search</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Event or year" />
          </label>
          <div className="countries" aria-label="Filter by country">
            <button className={!country ? 'active' : ''} onClick={() => setCountry(null)}>All</button>
            {catalogue.countries.map(value => (
              <button key={value} className={country === value ? 'active' : ''} onClick={() => setCountry(value === country ? null : value)}>{value}</button>
            ))}
          </div>
        </div>

        <div className="shelf">
          {visible.map((item, index) => (
            <button className={`paper-card ${item.thumb ? '' : 'paper-card--pending'}`} key={item.id} onClick={() => open(item)} disabled={!item.thumb} style={{ '--delay': `${Math.min(index, 8) * 55}ms` } as React.CSSProperties}>
              <span className="paper-frame">
                {item.thumb ? <img src={publicUrl(item.thumb)} alt={`Front page for ${item.label}`} loading="lazy" /> : <span className="pending-page"><i>Rights review</i><b>{item.date.slice(0, 4)}</b></span>}
                {item.thumb && <span className="read-cue">Open to read</span>}
              </span>
              <span className="paper-copy">
                <b>{item.label}</b>
                <time>{formatDate(item.date)}</time>
                <small>{item.archive?.title ?? (item.event ? 'Playable story' : 'Archive search pending')}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className={`reader ${playing ? 'reader--playing' : ''}`}>
          <header className="reader-header">
            <button className="back" onClick={close}>← Catalogue</button>
            <div>
              <span>{formatDate(selected.date)}</span>
              <h2>{selected.label}</h2>
            </div>
            <div className="zoom-controls" aria-label="Zoom controls">
              <button onClick={() => zoom(-0.2)} aria-label="Zoom out">−</button>
              <button onClick={resetView}>Fit</button>
              <button onClick={() => zoom(0.2)} aria-label="Zoom in">+</button>
            </div>
          </header>

          <div className="reader-stage" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
            <div className="ambient-light" />
            <img
              className="reader-page"
              src={publicUrl(selected.thumb!)}
              alt={`Full front page for ${selected.label}`}
              draggable={false}
              style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
            />
            {!playing && <p className="reader-hint">Scroll to zoom. Drag to move across the page.</p>}
          </div>

          <footer className="player">
            <audio
              ref={audioRef}
              key={selected.id}
              src={publicUrl(`assets/${selected.id}/audio/narration.mp3`)}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={event => setProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0)}
            />
            <button className="play" onClick={() => void play()}><span>{playing ? 'Ⅱ' : '▶'}</span>{playing ? 'Pause' : 'Begin'}</button>
            <div className="narration">
              <span>{playing ? 'Narration' : 'When you are ready'}</span>
              <p>{narration[selected.id]}</p>
              <i style={{ transform: `scaleX(${progress})` }} />
            </div>
            {selected.archive && <a href={selected.archive.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}
          </footer>
        </section>
      )}
    </main>
  );
}
