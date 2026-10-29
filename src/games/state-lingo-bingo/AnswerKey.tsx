import { useEffect, useMemo, useRef, useState } from 'react';
import { regions, states, type Region } from './engine';

/** Teacher answer key: every state and capital the game checks answers against, sized for a phone in a bright gym. */
export default function AnswerKey() {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<Region[]>([]);
  const [found, setFound] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => { document.title = 'Answer key · State Lingo Bingo'; }, []);
  const list = useMemo(() => [...states].sort((a, b) => a.name.localeCompare(b.name)).filter(s => !shown.length || shown.includes(s.region as Region)), [shown]);
  // Typing jumps to the first state whose name starts with the text, then any whose capital does, then any containing it.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    const match = !q ? undefined : list.find(s => s.name.toLowerCase().startsWith(q)) ?? list.find(s => s.capital.toLowerCase().startsWith(q))
      ?? list.find(s => s.name.toLowerCase().includes(q) || s.capital.toLowerCase().includes(q));
    setFound(match?.code ?? null);
    if (match) rows.current.get(match.code)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [query, list]);
  const toggle = (r: Region) => setShown(s => s.includes(r) ? s.filter(x => x !== r) : regions.filter(x => x === r || s.includes(x)));
  return <div className="slb-key">
    <header className="slb-key-top">
      <p className="slb-key-eyebrow">STATE LINGO BINGO · TEACHER ONLY</p>
      <h1>Answer key</h1>
      <input type="search" aria-label="Find a state" placeholder="Find a state…" autoComplete="off" spellCheck={false} value={query} onChange={e => setQuery(e.target.value)} />
      <div className="slb-key-chips" role="group" aria-label="Regions">
        <button aria-pressed={!shown.length} onClick={() => setShown([])}>All 50</button>
        {regions.map(r => <button key={r} aria-pressed={shown.includes(r)} onClick={() => toggle(r)}>{r}</button>)}
      </div>
      <p className="slb-key-status" role="status">{query.trim() && !found ? `No state matches “${query.trim()}”.` : `${list.length} states · A–Z`}</p>
    </header>
    <ol className="slb-key-list" aria-label="States and capitals">
      {list.map(s => <li key={s.code} ref={el => { if (el) rows.current.set(s.code, el); else rows.current.delete(s.code); }} className={s.code === found ? 'slb-key-found' : ''} data-testid={`key-${s.code}`}>
        <span className="slb-key-state">{s.name}</span><span className="slb-key-capital">{s.capital}</span>
      </li>)}
    </ol>
  </div>;
}
