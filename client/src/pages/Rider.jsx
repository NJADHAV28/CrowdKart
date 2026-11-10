import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, IndianRupee, MapPin, Navigation, Package, Phone, Power, Store as StoreIcon, StickyNote, UserRound } from 'lucide-react';
import { api, inr } from '../api.js';
import { getSocket } from '../socket.js';
import { useApp } from '../App.jsx';
import RiderMap from '../components/RiderMap.jsx';

const directions = (loc) => `https://www.google.com/maps/dir/?api=1&destination=${loc[0]},${loc[1]}&travelmode=driving`;

/** Delivery partner panel: go online, share GPS, see jobs with pickup + customer details, mark stops done. */
export default function Rider() {
  const { user, setUser, toast } = useApp();
  const [data, setData] = useState(null);
  const [online, setOnline] = useState(Boolean(user.online));
  const [pos, setPos] = useState(user.location || null);
  const [gps, setGps] = useState('off');
  const [busy, setBusy] = useState(false);
  const [openStop, setOpenStop] = useState(null);
  const lastSent = useRef(0);

  const load = useCallback(() => api.get('/rider/jobs').then(setData).catch((e) => toast({ kind: 'error', text: e.message })), [toast]);
  useEffect(() => {
    load();
    api.get('/me').then((r) => { setOnline(Boolean(r.user.online)); setUser(r.user); }).catch(() => {});
    const s = getSocket();
    const onJob = (e) => { load(); if (e?.new) toast({ title: 'New delivery assigned', text: 'Check your pickups below.' }); };
    s?.on('job:update', onJob);
    const t = setInterval(load, 8000);
    return () => { s?.off('job:update', onJob); clearInterval(t); };
  }, [load, toast]);

  // While online: watch the phone's GPS and send it to the server (at most every 5 s)
  useEffect(() => {
    if (!online || !navigator.geolocation) { setGps(online ? 'unavailable' : 'off'); return undefined; }
    setGps('locating');
    const id = navigator.geolocation.watchPosition((p) => {
      const loc = [p.coords.latitude, p.coords.longitude];
      setPos(loc); setGps('live');
      if (Date.now() - lastSent.current > 5000) { lastSent.current = Date.now(); api.post('/rider/location', { location: loc }).catch(() => {}); }
    }, () => setGps('denied'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [online]);

  const toggleOnline = async () => {
    setBusy(true);
    try {
      const r = await api.post('/rider/status', { online: !online, location: pos || undefined });
      setOnline(r.user.online); setUser(r.user);
      toast(r.user.online ? 'You’re online. New deliveries near you will be assigned to you.' : 'You’re offline.');
    } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  const done = async (job, s) => {
    setBusy(true);
    try { setData(await api.post(`/rider/jobs/${job.deliveryId}/stops/${s.idx}/done`)); toast(s.kind === 'pickup' ? `Picked up from ${s.store.name}` : `Delivered to ${s.customer.name}`); }
    catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  const job = data?.active?.[0];
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
      {/* Status bar */}
      <div className={`flex items-center gap-4 rounded-3xl p-5 text-white ${online ? 'bg-brand' : 'bg-night'}`}>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-white/70">Delivery partner · {user.vehicle || 'Bike'}</div>
          <div className="text-xl font-bold">{user.name}</div>
          <div className="mt-0.5 text-xs text-white/80">
            {online ? (gps === 'live' ? 'Online · sharing live location' : gps === 'denied' ? 'Online · allow location access to receive jobs' : 'Online · getting your location…') : 'Offline · go online to receive deliveries'}
          </div>
        </div>
        <button onClick={toggleOnline} disabled={busy} className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-4 transition ${online ? 'bg-white text-brand ring-white/30' : 'bg-white/10 text-white ring-white/10 hover:bg-white/20'}`} aria-label={online ? 'Go offline' : 'Go online'}>
          <Power size={24} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat Icon={Package} label="Active" value={data?.active.length ?? '–'} />
        <Stat Icon={CheckCircle2} label="Delivered" value={data?.history.length ?? '–'} />
        <Stat Icon={IndianRupee} label="Earned today" value={data ? inr(data.today) : '–'} />
      </div>

      {!job && data && (
        <div className="card mt-4 flex flex-col items-center p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand"><Clock size={28} /></div>
          <div className="mt-3 font-semibold">{online ? 'Waiting for a delivery…' : 'You’re offline'}</div>
          <p className="mt-1 max-w-xs text-sm text-sub">{online ? 'When neighbours near you finish paying, the delivery is assigned to the nearest online partner.' : 'Tap the power button to start receiving deliveries.'}</p>
        </div>
      )}

      {job && (
        <div className="mt-4 md:grid md:grid-cols-[1.2fr_1fr] md:gap-5">
          <div className="card overflow-hidden p-2 md:sticky md:top-4 md:self-start">
            <RiderMap job={job} pos={pos || job.pos} />
            <div className="flex items-center justify-between px-2 pb-1 pt-3 text-sm">
              <span><b>{job.stopsDone}</b> of {job.totalStops} stops done · {job.routeKm} km</span>
              <span className="font-semibold text-brand">{inr(job.earnings.trip)}{job.earnings.tips ? ` + ${inr(job.earnings.tips)} tips` : ''}</span>
            </div>
          </div>

          <div className="mt-4 space-y-3 md:mt-0">
            {job.stops.map((s) => {
              const next = s.idx === job.stopsDone;
              const expanded = openStop === `${job.deliveryId}:${s.idx}` || next;
              return (
                <div key={s.idx} className={`card overflow-hidden ${next ? 'ring-2 ring-brand' : ''} ${s.done ? 'opacity-60' : ''}`}>
                  <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenStop(expanded && !next ? null : `${job.deliveryId}:${s.idx}`)}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${s.done ? 'bg-faint' : s.kind === 'pickup' ? 'bg-[#e4572e]' : 'bg-brand'}`}>{s.done ? '✓' : s.idx + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-sub">{s.kind === 'pickup' ? 'Pick up' : 'Deliver to'}{next ? ' · next' : ''}</span>
                      <span className="block truncate font-semibold">{s.kind === 'pickup' ? s.store.name : s.customer.name}</span>
                    </span>
                    {!next && <ChevronDown size={18} className={`text-faint transition ${expanded ? 'rotate-180' : ''}`} />}
                  </button>
                  {expanded && (
                    <div className="border-t border-line px-4 pb-4 pt-3 text-sm">
                      {s.kind === 'pickup' ? (
                        <>
                          {s.store.address && <div className="flex gap-2 text-sub"><StoreIcon size={15} className="mt-0.5 shrink-0" />{s.store.address}</div>}
                          {s.orders.map((o) => (
                            <div key={o.ref} className="mt-3 rounded-xl bg-page p-3">
                              <div className="mb-1 text-xs font-semibold text-sub">Order {o.ref}</div>
                              {o.items.map((it, k) => <div key={k} className="flex justify-between"><span>{it.name}{it.unit ? <span className="text-sub"> · {it.unit}</span> : null}</span><b>× {it.qty}</b></div>)}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div className="flex gap-2"><UserRound size={15} className="mt-0.5 shrink-0 text-sub" /><span><b>{s.customer.name}</b>{s.customer.flat ? `, ${s.customer.flat}` : ''}</span></div>
                          <div className="mt-1.5 flex gap-2 text-sub"><MapPin size={15} className="mt-0.5 shrink-0" />{s.customer.address}</div>
                          {s.instructions.length > 0 && (
                            <div className="mt-3 rounded-xl bg-sun-soft p-3">
                              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#8a6300]"><StickyNote size={13} />Instructions</div>
                              {s.instructions.map((x) => <div key={x}>• {x.replace(/^Note: /, '')}</div>)}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sub"><span>Order {s.ref}</span><span>{s.items} items{s.shops > 1 ? ` from ${s.shops} shops` : ''}</span><span className="font-semibold text-brand">Prepaid</span>{s.tip > 0 && <span className="font-semibold text-brand">Tip {inr(s.tip)}</span>}</div>
                        </>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={directions(s.location)} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-4 !py-2 text-xs"><Navigation size={14} />Navigate</a>
                        {(s.kind === 'pickup' ? s.store.phone : s.customer.phone) && <a href={`tel:${s.kind === 'pickup' ? s.store.phone : s.customer.phone}`} className="btn-secondary !px-4 !py-2 text-xs"><Phone size={14} />Call</a>}
                        {next && <button disabled={busy} onClick={() => done(job, s)} className="btn-primary ml-auto !px-5 !py-2 text-xs">{s.kind === 'pickup' ? 'Picked up' : 'Delivered'}</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data?.history?.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-bold">Completed</h2>
          <div className="card divide-y divide-line">
            {data.history.slice(0, 10).map((j) => (
              <div key={j.deliveryId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{new Date(j.deliveredAt || j.startedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {j.totalStops} stops</span>
                <b className="tnum">{inr(j.earnings.total)}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ Icon, label, value }) => (
  <div className="card p-3.5"><Icon size={18} className="text-brand" /><div className="tnum mt-1 text-lg font-bold">{value}</div><div className="text-[11px] text-sub">{label}</div></div>
);
