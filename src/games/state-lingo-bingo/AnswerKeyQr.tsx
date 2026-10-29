import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { ANSWER_KEY_PATH } from './answerKeyPath';

/** Setup-only link to the teacher answer key, with a QR code drawn in the browser (nothing is sent anywhere). */
export default function AnswerKeyQr() {
  const url = `${location.origin}${ANSWER_KEY_PATH}`;
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url); qr.make();
    const n = qr.getModuleCount(), cells: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + 4} ${r + 4}h1v1h-1z`);
    return { d: cells.join(''), size: n + 8 }; // 4-module quiet zone on every side
  }, [url]);
  return <a className="slb-key-link" href={ANSWER_KEY_PATH} target="_blank" rel="noopener" data-testid="answer-key-link">
    <svg viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label="QR code for the answer key" shapeRendering="crispEdges"><rect width={path.size} height={path.size} fill="#fff" /><path d={path.d} fill="#0B1F44" /></svg>
    <span>Answer key on your phone<small>For teachers</small></span>
  </a>;
}
