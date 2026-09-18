import { useEffect, useRef, type ReactNode } from 'react';
export default function AssessmentDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="assessment-modal" ref={dialog} aria-label="Assessment and Session History" onCancel={onClose}><button className="assessment-close" onClick={onClose}>Close</button>{children}</dialog>;
}
