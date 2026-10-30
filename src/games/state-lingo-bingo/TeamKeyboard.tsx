import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

/** Keys are buttons that write to this team's own answer; nothing here takes text focus, so the touch keyboard never opens
 *  and up to 10 teams can type at once on one multi-touch board. */
export type KeyPress = { kind: 'letter'; letter: string } | { kind: 'space' } | { kind: 'back' } | { kind: 'submit' };

const QWERTY = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GAP = 4, MIN_QWERTY = 44;

interface Layout { kind: 'qwerty' | 'az'; cols: number; key: number }
/** QWERTY when its keys can be at least 44px; otherwise an A–Z keypad with the column count that gives the biggest keys. */
export function keyboardLayout(width: number, height: number): Layout {
  const rowsHeight = (rows: number) => (height - (rows - 1) * GAP) / rows;
  const qwerty = Math.min((width - 9 * GAP) / 10, rowsHeight(4));
  let best: Layout = { kind: 'qwerty', cols: 10, key: qwerty };
  if (qwerty >= MIN_QWERTY) return best;
  for (let cols = 5; cols <= 14; cols++) {
    const rows = Math.ceil(ALPHABET.length / cols) + 1; // letters, then a ⌫ + Space + Submit row
    const key = Math.min((width - (cols - 1) * GAP) / cols, rowsHeight(rows));
    if (key > best.key) best = { kind: 'az', cols, key };
  }
  return best;
}

function Key({ label, children, className = '', style, disabled, onPress }: { label: string; children: ReactNode; className?: string; style?: CSSProperties; disabled?: boolean; onPress: () => void }) {
  // Touch and pen: each finger's press is handled on its own pointer, so presses on different cards never wait for each other.
  // Mouse and the keyboard's Enter/Space use click. A touch press is not counted twice by the click that follows it.
  const touched = useRef(0);
  function up(e: PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === 'mouse' || disabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    touched.current = Date.now();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) onPress();
  }
  return <button type="button" className={`slb-key ${className}`} style={style} aria-label={label} disabled={disabled}
    onPointerDown={e => { if (e.pointerType !== 'mouse') e.preventDefault(); }} onMouseDown={e => e.preventDefault()}
    onPointerUp={up} onClick={() => { if (Date.now() - touched.current > 700) onPress(); }}>{children}</button>;
}

/** Only the keys; the team's answer shows in its target bar, so the keys get the height. */
export default function TeamKeyboard({ teamName, draft, onKey }: { teamName: string; draft: string; onKey: (key: KeyPress) => void }) {
  const keys = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ kind: 'qwerty', cols: 10, key: 44 });
  useLayoutEffect(() => {
    const el = keys.current!;
    const fit = () => setLayout(keyboardLayout(el.clientWidth, el.clientHeight));
    fit();
    const observer = new ResizeObserver(fit); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const k = Math.floor(layout.key), font = Math.max(14, Math.min(k * 0.5, 40));
  const letter = (l: string, style?: CSSProperties) => <Key key={l} label={`${l}: ${teamName}`} style={style} onPress={() => onKey({ kind: 'letter', letter: l })}>{l}</Key>;
  const back = (style?: CSSProperties) => <Key key="back" label={`Backspace: ${teamName}`} className="slb-key-back" style={style} disabled={!draft} onPress={() => onKey({ kind: 'back' })}>⌫</Key>;
  const space = (style?: CSSProperties) => <Key key="space" label={`Space: ${teamName}`} className="slb-key-space" style={style} onPress={() => onKey({ kind: 'space' })}>Space</Key>;
  const submit = (style?: CSSProperties) => <Key key="submit" label={`Submit: ${teamName}`} className="slb-key-submit" style={style} disabled={!draft.trim()} onPress={() => onKey({ kind: 'submit' })}>Submit</Key>;
  let grid: ReactNode, template: CSSProperties;
  if (layout.kind === 'qwerty') {
    // 20 half-columns so the second and third rows sit offset like a real keyboard.
    template = { gridTemplateColumns: `repeat(20, minmax(0, 1fr))`, gridTemplateRows: `repeat(4, ${k}px)` };
    grid = <>{QWERTY[0].split('').map(l => letter(l, { gridColumn: 'span 2' }))}
      {QWERTY[1].split('').map((l, i) => letter(l, { gridColumn: i === 0 ? '2 / span 2' : 'span 2' }))}
      {QWERTY[2].split('').map((l, i) => letter(l, { gridColumn: i === 0 ? '2 / span 2' : 'span 2' }))}{back({ gridColumn: 'span 4' })}
      {space({ gridColumn: '1 / span 10' })}{submit({ gridColumn: '11 / span 10' })}</>;
  } else {
    const rows = Math.ceil(ALPHABET.length / layout.cols) + 1, c = layout.cols;
    const backSpan = Math.max(1, Math.round(c / 5)), spaceSpan = Math.floor((c - backSpan) / 2);
    template = { gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, ${k}px)` };
    grid = <>{ALPHABET.split('').map(l => letter(l))}{back({ gridColumn: `1 / span ${backSpan}`, gridRow: rows })}
      {space({ gridColumn: `${backSpan + 1} / span ${spaceSpan}`, gridRow: rows })}{submit({ gridColumn: `${backSpan + spaceSpan + 1} / span ${c - backSpan - spaceSpan}`, gridRow: rows })}</>;
  }
  return <div ref={keys} className="slb-kbd" role="group" aria-label={`${teamName} answer keyboard`} data-layout={layout.kind} style={{ '--key-font': `${font}px` } as CSSProperties}>
    <div className="slb-kbd-grid" style={template}>{grid}</div>
  </div>;
}
