import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MapPin, Navigation, Phone, Star } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import PlacesMap, { GROUPS, placeGroup } from '../components/PlacesMap.jsx';
import { Empty, PageHeader } from '../components/ui.jsx';

const RADII = [1, 3, 5];
const directions = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.location[0]},${p.location[1]}`;

/** Every restaurant, hotel, shop, bakery, café and pharmacy around your delivery address. */
export default function Nearby() {
  const { user, openLocation, toast } = useApp();
  const [data, setData] = useState(null);
  const [radius, setRadius] = useState(3);
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [group, q, radius]);
  const listRef = useRef(null);

  useEffect(() => {
    setData(null);
    api.get(`/places/explore?radius=${radius}`).then(setData).catch((e) => { toast({ kind: 'error', text: e.message }); setData({ places: [], center: user.location, radiusKm: radius }); });
  }, [radius, toast, user.location]);

  const counts = useMemo(() => {
    const c = {};
    for (const p of data?.places || []) { const g = placeGroup(p); c[g] = (c[g] || 0) + 1; }
    return c;
  }, [data]);
  const shown = useMemo(() => (data?.places || []).filter((p) => (group === 'all' || placeGroup(p) === group)
    && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [data, group, q]);

  const select = (id) => {
    setSel(id);
    const idx = shown.findIndex((p) => p.id === id);
    if (idx >= limit) setLimit(idx + 10);
    const el = listRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const center = data?.center || user.location;
  const gq = group === 'all' ? 'restaurants and shops' : GROUPS[group].gq;
  const googleSearch = `https://www.google.com/maps/search/${encodeURIComponent(gq)}/@${center[0]},${center[1]},15z`;

  return (
    <div className="px-4 pt-4 md:px-6">
      <PageHeader title="Places near you" back="/" />

      <button onClick={openLocation} className="card mb-4 flex w-full items-center gap-3 p-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><MapPin size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{user.area || 'Your location'}</span><span className="block truncate text-xs text-sub">{user.address}</span></span>
        <span className="text-xs font-semibold text-brand">Change</span>
      </button>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        <Chip active={group === 'all'} onClick={() => setGroup('all')}>All {data ? `(${data.places.length})` : ''}</Chip>
        {Object.entries(GROUPS).map(([k, g]) => (
          <Chip key={k} active={group === k} onClick={() => setGroup(k)} color={g.color}>
            <g.Icon size={13} />{g.label}{counts[k] ? ` (${counts[k]})` : ''}
          </Chip>
        ))}
      </div>

      <div className="mt-4 md:grid md:grid-cols-[1.3fr_1fr] md:gap-5">
        <div className="md:sticky md:top-4 md:self-start">
          <div className="card overflow-hidden p-1.5">
            {data ? <PlacesMap center={center} radiusKm={data.radiusKm} places={shown} selectedId={sel} onSelect={select} className="h-80 md:h-[520px]" />
              : <div className="skeleton h-80 md:h-[520px]" />}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex rounded-full bg-white p-1 shadow-card">
              {RADII.map((r) => <button key={r} onClick={() => setRadius(r)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${radius === r ? 'bg-brand text-white' : 'text-sub'}`}>{r} km</button>)}
            </div>
            <a href={googleSearch} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold shadow-card hover:bg-page">
              <ExternalLink size={13} />See all on Google Maps
            </a>
          </div>
        </div>

        <div className="mt-5 md:mt-0">
          <input className="input !rounded-full !border-transparent shadow-card" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places…" />
          <div className="mt-2 px-1 text-xs text-sub">{data ? `${shown.length} places within ${data.radiusKm} km` : 'Finding places near you…'}</div>
          {data && !shown.length && <div className="mt-3"><Empty title="Nothing here yet" text="Try a bigger radius, or open Google Maps to see everything around you." /></div>}
          <div ref={listRef} className="mt-3 space-y-2.5">
            {shown.slice(0, limit).map((p) => {
              const g = GROUPS[placeGroup(p)];
              return (
                <div key={p.id} data-id={p.id} onClick={() => setSel(p.id)}
                  className={`card cursor-pointer p-3.5 transition ${sel === p.id ? 'ring-2 ring-brand' : ''}`}>
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: g.color }}><g.Icon size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-sub">{g.label.replace(/s$/, '')}{p.address ? ` · ${p.address}` : ''}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-sub">
                        <span className="tnum">{p.distanceKm} km</span>
                        {p.rating && <span className="inline-flex items-center gap-0.5 font-semibold text-ink"><Star size={11} className="fill-[#f5a623] text-[#f5a623]" />{p.rating.toFixed(1)}{p.ratingCount ? <span className="font-normal text-sub">({p.ratingCount})</span> : null}</span>}
                        {p.openNow === true && <span className="font-semibold text-brand">Open now</span>}
                        {p.openNow === false && <span className="font-semibold text-danger">Closed</span>}
                        {p.orderable ? <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-dark">Delivers to you</span> : null}
                      </div>
                    </div>
                  </div>
                  {sel === p.id && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                      {p.orderable && <Link to={`/store/${p.id}`} className="btn-primary !px-4 !py-2 text-xs">Order</Link>}
                      <a href={directions(p)} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-4 !py-2 text-xs"><Navigation size={13} />Directions</a>
                      <a href={p.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-4 !py-2 text-xs"><ExternalLink size={13} />Google Maps</a>
                      {p.phone && <a href={`tel:${p.phone}`} className="btn-secondary !px-4 !py-2 text-xs"><Phone size={13} />Call</a>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {shown.length > limit && <button className="btn-secondary mt-3 w-full" onClick={() => setLimit((l) => l + 60)}>Show more ({shown.length - limit} more)</button>}
          {data && !data.providers?.includes('google') && (
            <p className="mt-4 px-1 text-[11px] text-faint">Listings come from OpenStreetMap{data.providers?.includes('tomtom') ? ', TomTom' : ''}{data.providers?.includes('ola') ? ', Ola Maps' : ''}. Some places on Google Maps may be missing here; tap “See all on Google Maps” to view them.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const Chip = ({ active, children, color, ...p }) => (
  <button {...p} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition ${active ? 'text-white' : 'bg-white text-ink shadow-card hover:bg-page'}`}
    style={active ? { background: color || '#2fa866' } : undefined}>{children}</button>
);
