import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bike, Loader2, Lock, Search, Store as StoreIcon } from 'lucide-react';
import { api, needsServerChoice, serverUrl, setServerUrl } from '../api.js';
import { useApp } from '../App.jsx';
import { Logo, StoreIcon as KindIcon, storeSubtitle } from '../components/ui.jsx';
import LocationPicker from '../components/LocationPicker.jsx';

const HERO = ['apples', 'margherita-pizza', 'broccoli', 'cappuccino', 'masala-dosa', 'bananas'];

export default function Login() {
  const { configError, reloadConfig, login, toast } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState('customer');
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [place, setPlace] = useState(null);
  const [flat, setFlat] = useState('');
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState(serverUrl());

  const submit = async (payload) => {
    setBusy(true);
    try {
      const r = await api.post('/auth/login', payload);
      login(r.token, r.user);
      nav(r.user.role === 'merchant' ? '/merchant' : r.user.role === 'rider' ? '/rider' : '/');
    } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-full md:flex md:items-center md:justify-center md:py-10">
      <div className="mx-auto w-full max-w-md overflow-hidden bg-white md:rounded-[32px] md:shadow-card">
        <div className="pt-safe relative bg-night px-6 pb-8 pt-6 text-white">
          <Logo light />
          <div className="mt-5 grid grid-cols-6 gap-1.5">
            {HERO.map((h) => <img key={h} src={`./products/${h}.jpg`} alt="" className="aspect-square w-full rounded-full object-cover ring-2 ring-white/10" />)}
          </div>
          <h1 className="mt-5 text-2xl font-semibold leading-snug">Order with your neighbours.<br /><span className="text-brand">Share one delivery.</span></h1>
          <p className="mt-2 text-sm text-white/65">Food, groceries and more from real stores near you. When neighbours order too, one rider brings it all and everyone pays less.</p>
        </div>

        <div className="px-6 pb-8 pt-6">
          {configError && <div className="mb-4 rounded-xl bg-warn-soft p-3 text-sm text-warn">Can’t connect right now. <button className="font-semibold underline" onClick={reloadConfig}>Try again</button></div>}

          {mode === 'customer' && step === 1 && (
            <>
              <label className="field-label">Your name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name is fine" autoFocus onKeyDown={(e) => e.key === 'Enter' && name.trim().length >= 2 && setStep(2)} />
              <p className="mt-1.5 text-xs text-faint">Only the store and your rider see it. Neighbours never do.</p>
              <button className="btn-primary mt-6 w-full !py-3.5" disabled={name.trim().length < 2} onClick={() => setStep(2)}>Continue</button>
              <button className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm text-sub hover:text-ink" onClick={() => setMode('merchant')}><StoreIcon size={15} />Own a shop or restaurant? Sign in here</button>
              <button className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm text-sub hover:text-ink" onClick={() => setMode('rider')}><Bike size={15} />Delivery partner? Sign in here</button>
              <button className="mt-6 flex w-full items-center justify-center gap-1 text-xs text-faint hover:text-ink" onClick={() => setMode('admin')}><Lock size={12} />Admin</button>
            </>
          )}

          {mode === 'customer' && step === 2 && (
            <>
              <button className="mb-3 flex items-center gap-1 text-sm text-sub hover:text-ink" onClick={() => setStep(1)}><ArrowLeft size={16} />Back</button>
              <h2 className="text-lg font-semibold">Where should we deliver?</h2>
              <p className="mb-4 mt-0.5 text-sm text-sub">We’ll show stores that deliver here.</p>
              <LocationPicker value={place} onChange={setPlace} />
              {place && (
                <>
                  <label className="field-label mt-4">Flat / house no. <span className="font-normal text-faint">(optional)</span></label>
                  <input className="input" value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="e.g. B-204, Shanti Apartments" />
                </>
              )}
              <button className="btn-primary mt-6 w-full !py-3.5" disabled={busy || !place?.location || place.label === 'Finding address…'} onClick={() => submit({ name: name.trim(), location: place.location, address: place.label, flat })}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : 'Start shopping'}
              </button>
            </>
          )}

          {mode === 'merchant' && <MerchantSignIn busy={busy} onBack={() => setMode('customer')} onSubmit={submit} />}
          {mode === 'rider' && <RiderSignIn busy={busy} onBack={() => setMode('customer')} onSubmit={submit} />}
          {mode === 'admin' && <AdminSignIn onBack={() => setMode('customer')} />}

          {needsServerChoice() && (
            <details className="mt-8 text-sm text-sub">
              <summary className="cursor-pointer">Connection settings</summary>
              <div className="mt-2 flex gap-2">
                <input className="input !py-2" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://crowdkart.example.com" />
                <button className="btn-secondary !py-2" onClick={() => { setServerUrl(server.trim()); reloadConfig(); toast('Saved'); }}>Save</button>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function MerchantSignIn({ busy, onBack, onSubmit }) {
  const { toast } = useApp();
  const [place, setPlace] = useState(null);
  const [stores, setStores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!place?.location || place.label === 'Finding address…') return;
    setLoading(true); setStores(null);
    api.get(`/places/nearby?lat=${place.location[0]}&lng=${place.location[1]}`).then(setStores).catch((e) => toast({ kind: 'error', text: e.message })).finally(() => setLoading(false));
  }, [place?.location?.[0], place?.location?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (stores || []).filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()));
  const kind = (s) => (s.category === 'food' ? 'indian' : s.category);
  return (
    <>
      <button className="mb-3 flex items-center gap-1 text-sm text-sub hover:text-ink" onClick={onBack}><ArrowLeft size={16} />Back</button>
      <h2 className="text-lg font-semibold">Find your store</h2>
      <p className="mb-4 mt-0.5 text-sm text-sub">Set your shop’s location, then pick it from the list.</p>
      {!picked ? (
        <>
          <LocationPicker value={place} onChange={setPlace} />
          {loading && <p className="mt-4 flex items-center gap-2 text-sm text-sub"><Loader2 size={16} className="animate-spin" />Looking for stores around here…</p>}
          {stores && (
            <div className="mt-5">
              <div className="relative mb-2"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" /><input className="input !pl-10" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" /></div>
              <ul className="max-h-72 divide-y divide-line overflow-auto rounded-xl border border-line">
                {shown.map((s) => (
                  <li key={s.id}>
                    <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-page" onClick={() => setPicked(s)}>
                      <KindIcon kind={kind(s)} size={38} radius={10} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="block truncate text-xs text-sub">{storeSubtitle(s)}{s.address ? ` · ${s.address}` : ''}</span></span>
                      <span className="tnum text-xs text-faint">{s.distanceKm} km</span>
                    </button>
                  </li>
                ))}
                {!shown.length && <li className="p-4 text-sm text-sub">No stores found here. Try moving the pin closer to your shop.</li>}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <KindIcon kind={kind(picked)} size={42} radius={12} />
            <div className="min-w-0 flex-1"><div className="truncate font-semibold">{picked.name}</div><div className="truncate text-xs text-sub">{storeSubtitle(picked)}</div></div>
            <button className="btn-text" onClick={() => setPicked(null)}>Change</button>
          </div>
          <label className="field-label mt-5">Your name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Store manager" />
          <button className="btn-primary mt-6 w-full !py-3.5" disabled={busy || name.trim().length < 2} onClick={() => onSubmit({ role: 'merchant', name: name.trim(), merchantId: picked.id })}>Open my store</button>
        </>
      )}
    </>
  );
}

function RiderSignIn({ busy, onBack, onSubmit }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('Bike');
  const ok = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 10;
  return (
    <>
      <button className="mb-3 flex items-center gap-1 text-sm text-sub hover:text-ink" onClick={onBack}><ArrowLeft size={16} />Back</button>
      <h2 className="text-lg font-semibold">Delivery partner sign-in</h2>
      <p className="mb-4 mt-0.5 text-sm text-sub">Go online to get deliveries near you. You’ll see pickup details and where to deliver.</p>
      <label className="field-label">Your name</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
      <label className="field-label mt-4">Mobile number</label>
      <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
      <label className="field-label mt-4">Vehicle</label>
      <div className="grid grid-cols-3 gap-2">
        {['Bike', 'Scooter', 'Bicycle'].map((v) => (
          <button key={v} onClick={() => setVehicle(v)} className={`rounded-xl border py-2.5 text-sm font-medium ${vehicle === v ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line'}`}>{v}</button>
        ))}
      </div>
      <button className="btn-primary mt-6 w-full !py-3.5" disabled={busy || !ok} onClick={() => onSubmit({ role: 'rider', name: name.trim(), phone, vehicle })}>Start delivering</button>
      <p className="mt-3 text-center text-[11px] text-faint">Your number is used to sign you in and is shown to shops when you pick up.</p>
    </>
  );
}

function AdminSignIn({ onBack }) {
  const { login, toast } = useApp();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/auth/admin', { username, password });
      login(r.token, r.user);
      nav('/');
    } catch (err) { toast({ kind: 'error', text: err.message }); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go}>
      <button type="button" className="mb-3 flex items-center gap-1 text-sm text-sub hover:text-ink" onClick={onBack}><ArrowLeft size={16} />Back</button>
      <h2 className="text-lg font-semibold">Admin sign-in</h2>
      <label className="field-label mt-4">Username</label>
      <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <label className="field-label mt-4">Password</label>
      <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit" className="btn-primary mt-6 w-full !py-3.5" disabled={busy || !username || !password}>{busy ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}</button>
    </form>
  );
}
