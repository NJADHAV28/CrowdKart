import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, MapPin, Phone, Star } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { BackButton, ProductCard, StoreIcon, storeSubtitle } from '../components/ui.jsx';

export default function Store() {
  const { id } = useParams();
  const { toast } = useApp();
  const nav = useNavigate();
  const [s, setS] = useState(null);
  const [tag, setTag] = useState('');

  useEffect(() => { api.get(`/merchants/${id}`).then(setS).catch((e) => { toast({ kind: 'error', text: e.message }); nav('/'); }); }, [id, toast, nav]);
  const tags = useMemo(() => [...new Set((s?.items || []).map((i) => i.tag).filter(Boolean))], [s]);
  if (!s) return <div className="space-y-3 p-4"><div className="skeleton h-40" /><div className="skeleton h-72" /></div>;
  const store = { id: s.id, name: s.name, kind: s.kind };
  const items = s.items.filter((i) => !tag || i.tag === tag);

  return (
    <div className="px-4 pt-4 md:px-6">
      <div className="relative mb-5 h-10"><BackButton /></div>
      <div className="card p-5">
        <div className="flex gap-4">
          <StoreIcon kind={s.kind} size={68} radius={18} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight">{s.name}</h1>
            <p className="text-sm text-sub">{storeSubtitle(s)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {s.rating && <span className="inline-flex items-center gap-1 font-semibold"><Star size={13} className="fill-[#f5a623] text-[#f5a623]" />{s.rating.toFixed(1)}</span>}
              {s.etaMin && <span className="tnum inline-flex items-center gap-1 text-sub"><Clock size={13} />{s.etaMin}–{s.etaMin + 8} min</span>}
              {s.distanceKm != null && <span className="tnum inline-flex items-center gap-1 text-sub"><MapPin size={13} />{s.distanceKm} km</span>}
            </div>
          </div>
        </div>
        {(s.address || s.phone || s.openingHours) && (
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-sub">
            {s.address && <div>{s.address}</div>}
            {s.openingHours && <div>Hours: {s.openingHours}</div>}
            {s.phone && <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-brand"><Phone size={12} />{s.phone}</a>}
          </div>
        )}
        {s.groupDiscount?.length > 0 && (
          <div className="mt-4 rounded-xl bg-brand-soft px-3.5 py-2.5 text-xs text-brand-dark">
            {s.groupDiscount[0].pct}% off when 2+ neighbours order here together, up to {s.groupDiscount.at(-1).pct}%.
          </div>
        )}
      </div>

      {tags.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
          {['', ...tags].map((t) => (
            <button key={t || 'all'} onClick={() => setTag(t)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium ${tag === t ? 'bg-brand text-white' : 'bg-white shadow-card'}`}>{t || 'All'}</button>
          ))}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((i) => <ProductCard key={i.id} item={i} store={store} />)}
      </div>
    </div>
  );
}
