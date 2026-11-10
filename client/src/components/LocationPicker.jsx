import { useEffect, useRef, useState } from 'react';
import { Marker } from 'react-leaflet';
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { api } from '../api.js';
import { BaseMap, ICONS, Recenter } from './Maps.jsx';

/**
 * Pick a delivery location: current GPS position, or type an address.
 * The pin can be dragged to fine-tune. value = { location: [lat,lng], label, short }
 */
export default function LocationPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 3) { setResults([]); return undefined; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const near = value?.location ? `&lat=${value.location[0]}&lng=${value.location[1]}` : '';
        setResults(await api.get(`/geo/search?q=${encodeURIComponent(q)}${near}`));
        setError('');
      } catch (e) { setError(e.message); } finally { setSearching(false); }
    }, 600);
    return () => clearTimeout(timer.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromPoint = async (location) => {
    onChange({ location, label: 'Finding address…', short: '' });
    try {
      const r = await api.get(`/geo/reverse?lat=${location[0]}&lng=${location[1]}`);
      onChange({ location, label: r.label, short: r.short });
    } catch {
      onChange({ location, label: `${location[0].toFixed(5)}, ${location[1].toFixed(5)}`, short: 'Pinned location' });
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) { setError('Location isn’t available on this device. Type your address instead.'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); fromPoint([p.coords.latitude, p.coords.longitude]); },
      () => { setLocating(false); setError('We couldn’t get your location. Allow location access, or type your address.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div>
      <button type="button" className="btn-secondary w-full justify-start !text-brand" onClick={useGps} disabled={locating}>
        {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        {locating ? 'Getting your location…' : 'Use my current location'}
      </button>

      <div className="my-3 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />or type it<span className="h-px flex-1 bg-line" /></div>

      <div className="relative">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Building, street or area" />
        {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-faint" />}
      </div>
      {results.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-auto rounded-lg border border-line bg-white">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-page" onClick={() => { onChange({ location: r.location, label: r.label, short: r.short }); setResults([]); setQ(''); }}>
                <MapPin size={16} className="mt-0.5 shrink-0 text-faint" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.short}</span><span className="block truncate text-xs text-sub">{r.label}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 3 && !searching && !results.length && !error && <p className="mt-2 text-sm text-sub">No matches yet. Try adding your city.</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {value?.location && (
        <div className="mt-4">
          <BaseMap center={value.location} zoom={17} className="h-44">
            <Recenter at={value.location} />
            <Marker position={value.location} icon={ICONS.home} draggable eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); fromPoint([ll.lat, ll.lng]); } }} />
          </BaseMap>
          <div className="mt-2 flex gap-2">
            <MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{value.short || 'Selected location'}</div>
              <div className="text-xs text-sub">{value.label}</div>
              <div className="mt-0.5 text-xs text-faint">Drag the pin if it’s not exactly right.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
