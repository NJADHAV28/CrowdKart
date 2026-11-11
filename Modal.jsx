import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Small centered dialog used for Notifications, Settings, Link copied, Tracking, Mobile menu, Product added. */
export default function Modal({ title, icon: Icon, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fade-in fixed inset-0 z-[900] flex items-start justify-center bg-navy/40 p-4 pt-24" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="rise-in w-full max-w-[380px] rounded-2xl bg-white p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">{Icon && <Icon size={18} />}{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ws-mute hover:text-navy"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
