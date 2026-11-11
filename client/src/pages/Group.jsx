import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bike, CheckCircle2, Users } from 'lucide-react';
import { api, inr } from '../api.js';
import { getSocket } from '../socket.js';
import { useApp } from '../App.jsx';
import Countdown from '../components/Countdown.jsx';
import PayButton from '../components/PayButton.jsx';
import { TrackMap } from '../components/Maps.jsx';
import { PageHeader, ProductImg, Row } from '../components/ui.jsx';

const STEPS = ['Ordered', 'Paid', 'On the way', 'Delivered'];

/** What the rider is doing, from this customer's point of view. */
function myProgress(g, rider) {
  const mr = g.myRider;
  if (!mr || !rider) return null;
  const done = rider.stopsDone;
  if (done > mr.myDropIndex) return { text: 'Delivered to your door', delivered: true, minutes: 0 };
  const minutes = Math.max(1, Math.ceil(((rider.etaSec || 0) * (mr.myDropIndex + 1 - done)) / Math.max(1, rider.totalStops - done) / 60));
  if (done <= mr.myPickupIndex) return { text: `${rider.name} is picking up your order from ${g.me.orders.length > 1 ? `${g.me.orders.length} shops` : g.me.order.store.name}`, minutes, beforePickup: true };
  if (done < mr.pickups) return { text: `${rider.name} has your order and is collecting your neighbours’ orders`, minutes };
  const before = mr.myDropIndex - done;
  return { text: before > 0 ? `${rider.name} is on the way · ${before} ${before === 1 ? 'drop' : 'drops'} before yours` : `${rider.name} is heading to you now`, minutes };
}

export default function Group() {
  const { id } = useParams();
  const { toast } = useApp();
  const nav = useNavigate();
  const [g, setG] = useState(null);
  const [note, setNote] = useState('');
  const [liveRiders, setLiveRiders] = useState(null);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(null);

  const load = useCallback(() => api.get(`/groups/${id}`).then(setG).catch((e) => { toast({ kind: 'error', text: e.message }); nav('/'); }), [id, nav, toast]);
  useEffect(() => {
    load();
    const s = getSocket();
    const watch = () => s?.emit('group:watch', id);
    watch();
    s?.on('connect', watch);
    const onUpd = (e) => e.groupId === id && load();
    const onRider = (e) => e.groupId === id && setLiveRiders(e.riders);
    s?.on('group:update', onUpd);
    s?.on('rider:update', onRider);
    return () => { s?.off('connect', watch); s?.off('group:update', onUpd); s?.off('rider:update', onRider); };
  }, [id, load]);
  useEffect(() => {
    if (g && g.participants > 1) api.get(`/groups/${id}/insight`).then((r) => setNote(r.text)).catch(() => {});
  }, [id, g?.status, g?.participants]); // eslint-disable-line react-hooks/exhaustive-deps

  // Road route from the rider to me, refreshed as they move
  useEffect(() => {
    if (g?.status !== 'in_transit') { setRoute(null); return undefined; }
    let live = true;
    const get = () => api.get(`/groups/${id}/route`).then((r) => live && setRoute(r.points)).catch(() => {});
    get();
    const t = setInterval(get, 8000);
    return () => { live = false; clearInterval(t); };
  }, [id, g?.status]);

  if (!g) return <div className="space-y-3 p-4"><div className="skeleton h-32" /><div className="skeleton h-72" /></div>;

  const act = async (fn, ok) => {
    setBusy(true);
    try { const r = await fn(); if (r?.id === g.id) setG(r); if (ok) toast(ok); } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };
  const b = g.me.bill;
  const rider = (liveRiders || g.delivery?.riders || []).find((r) => r.riderId === g.myRider?.riderId);
  const progress = ['in_transit', 'delivered'].includes(g.status) ? myProgress(g, rider) : null;
  const deliveredToMe = g.status === 'delivered' || progress?.delivered;
  const step = deliveredToMe ? 3 : ['in_transit', 'paid'].includes(g.status) ? 2 : g.status === 'awaiting_payment' && g.me.pay !== 'pending' ? 1 : 0;
  const others = g.participants - 1;

  let title, subtitle;
  if (g.status === 'open') { title = others ? `Grouped with ${others} ${others === 1 ? 'neighbour' : 'neighbours'}` : 'Looking for neighbours nearby'; subtitle = 'Payment opens when the group closes. In a hurry? Checkout now.'; }
  else if (g.status === 'awaiting_payment') { title = g.me.pay === 'pending' ? 'Ready to pay' : 'Waiting for neighbours to pay'; subtitle = g.me.pay === 'pending' ? (g.upi?.status === 'submitted' ? 'Confirming your UPI payment…' : 'Pay by UPI, card or wallet to confirm your order.') : `${g.paidCount} of ${g.participants} paid. The rider leaves once everyone has paid.`; }
  else if (deliveredToMe) { title = 'Delivered'; subtitle = 'Enjoy! Thanks for sharing the ride.'; }
  else if (progress) { title = `Arriving in ${progress.minutes} min`; subtitle = progress.text; }
  else { title = 'Order confirmed'; subtitle = 'Assigning a rider…'; }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 md:px-6">
      <PageHeader title="Order details" back="/orders" />

      <div className="card p-5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-sub">{subtitle}</p>
        {g.status === 'open' && <p className="tnum mt-2 text-sm font-medium text-warn">Group closes in <Countdown to={g.closesAt} done="a moment" /></p>}
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s}>
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
              <div className={`mt-1.5 text-[10px] ${i <= step ? 'font-semibold text-ink' : 'text-faint'}`}>{s}</div>
            </div>
          ))}
        </div>
        {g.status === 'open' && (
          <div className="mt-5 flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => act(() => api.post(`/groups/${id}/lock`))}>Checkout &amp; pay now</button>
            <button className="btn-secondary" disabled={busy} onClick={() => act(async () => { await api.post(`/groups/${id}/leave`); nav('/'); }, 'Order cancelled')}>Cancel</button>
          </div>
        )}
      </div>

      {['paid', 'in_transit', 'delivered'].includes(g.status) && (
        <div className="card mt-4 overflow-hidden p-2">
          <TrackMap rider={deliveredToMe ? null : rider} store={g.me.order.store.location} home={g.me.order.location} showStore={!!progress?.beforePickup} route={deliveredToMe ? null : route} />
          {rider && !deliveredToMe && (
            <div className="flex items-center gap-3 px-2 pb-1 pt-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-night text-white"><Bike size={19} /></div>
              <div className="min-w-0 flex-1"><div className="font-semibold">{rider.name}</div><div className="text-xs text-sub">Your delivery partner</div></div>
            </div>
          )}
        </div>
      )}

      {g.status === 'awaiting_payment' && g.me.pay === 'pending' && (
        <div className="card mt-4 p-5">
          <h2 className="mb-3 font-semibold">Payment method</h2>
          <PayButton groupId={g.id} amountInr={b.total} onPaid={load} upiPayment={g.upi} />
        </div>
      )}
      {g.status === 'awaiting_payment' && g.me.pay !== 'pending' && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-soft p-4 text-sm font-medium text-brand-dark">
          <CheckCircle2 size={18} />{g.me.pay === 'covered' ? 'A neighbour paid for your order.' : g.paidByMe ? 'You paid for the whole group.' : 'Your payment is done.'}
        </div>
      )}

      <div className="card mt-4 p-5">
        {g.me.orders.map((o, idx) => (
          <div key={o.id} className={idx ? 'mt-4 border-t border-line pt-4' : ''}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{o.store.name}</h2>
              <span className="text-xs text-sub">ID {o.id.slice(4, 12).toUpperCase()}</span>
            </div>
            <ul className="space-y-2.5">
              {o.items.map((i) => (
                <li key={i.itemId} className="flex items-center gap-3 text-sm">
                  <ProductImg item={i} kind={o.store.kind} className="h-12 w-12 bg-page" rounded="rounded-lg" />
                  <span className="min-w-0 flex-1 truncate">{i.qty} × {i.name}</span>
                  <span className="tnum">{i.approxPrice ? '≈ ' : ''}{inr(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-4 space-y-2 border-t border-line pt-3">
          <Row label="Subtotal" value={inr(b.subtotal)} />
          {b.discount > 0 && <Row label={[b.discountPct && `Neighbour discount ${b.discountPct}%`, b.promoPct && `Promo ${b.promoPct}%`].filter(Boolean).join(' + ')} value={`−${inr(b.discount)}`} green />}
          <Row label="Delivery fee" value={b.deliveryShare < b.soloDeliveryFee ? <><s className="mr-1.5 text-faint">{inr(b.soloDeliveryFee)}</s>{inr(b.deliveryShare)}</> : inr(b.deliveryShare)} />
          <div className="border-t border-line pt-2"><Row label="Total" value={inr(b.total)} bold /></div>
        </div>
        {b.saving > 0 && <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-dark">You {g.savings.status === 'confirmed' ? 'saved' : 'save'} {inr(b.saving)} by sharing the delivery.</p>}
        <p className="mt-3 text-xs text-sub">Deliver to {g.me.order.address}</p>
      </div>

      {g.participants > 1 && (
        <div className="card mt-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Users size={18} />Shared delivery</h2>
          <p className="mt-2 text-sm text-sub">{note || g.plan?.reason}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {g.members.map((m) => <span key={m.alias} className={`rounded-full px-3 py-1 text-xs font-medium ${m.isMe ? 'bg-night text-white' : 'bg-page text-sub'}`}>{m.isMe ? 'You' : m.alias}</span>)}
          </div>
          <p className="mt-3 text-[11px] text-faint">Neighbours only see a nickname, never your name, address or items.</p>
        </div>
      )}
    </div>
  );
}
