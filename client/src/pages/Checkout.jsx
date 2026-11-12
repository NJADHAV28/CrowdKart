import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BellOff, Check, DoorOpen, Heart, Loader2, MapPin, PawPrint, PhoneOff, Shield, Tag, UserRound } from 'lucide-react';
import { api, inr } from '../api.js';
import { useApp } from '../App.jsx';
import { useCart } from '../state/cart.jsx';
import { PageHeader, ProductImg, Row } from '../components/ui.jsx';
import { readPromo, savePromo } from './Cart.jsx';

const WINDOWS = [[15, 'Now', 'Fastest delivery'], [30, 'In 30 min', 'More neighbours, bigger saving'], [45, 'In 45 min', 'Best chance of a group discount']];
const TIPS = [0, 10, 20, 30];
const INSTRUCTIONS = [
  ['Avoid calling', PhoneOff], ['Don’t ring the bell', BellOff], ['Leave at the door', DoorOpen], ['Leave with security', Shield], ['Pet at home', PawPrint],
];

/** Confirm address, delivery time, tip and instructions, then place one order for every shop in the cart. */
export default function Checkout() {
  const { user, setUser, toast, openLocation } = useApp();
  const cart = useCart();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [win, setWin] = useState(15);
  const [tip, setTip] = useState(0);
  const [custom, setCustom] = useState('');
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [promo, setPromo] = useState(readPromo());
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(user.phone || '');
  const [placedId, setPlacedId] = useState(null);
  // Just placed an order: go to its order/payment screen (checked before the empty-cart redirect,
  // because the cart is emptied right after placing).
  if (placedId) return <Navigate to={`/group/${placedId}`} replace />;
  if (!cart.count) return <Navigate to="/cart" replace />;

  const tipValue = custom ? Math.max(0, Math.min(200, Number(custom) || 0)) : tip;
  const promoOff = promo ? Math.round((cart.subtotal * promo.pct) / 100) : 0;
  const toggle = (x) => setNotes((n) => (n.includes(x) ? n.filter((y) => y !== x) : [...n, x]));

  const applyPromo = async () => {
    try { const r = await api.post('/promo', { code }); setPromo(r); savePromo(r); setCode(''); toast(`${r.pct}% off applied`); } catch (e) { toast({ kind: 'error', text: e.message }); }
  };

  const place = async () => {
    setBusy(true);
    try {
      if (phone.trim() !== (user.phone || '')) { const me = await api.patch('/me', { phone }); setUser(me.user); }
      const r = await api.post('/checkout', {
        windowMin: win, promo: promo?.code, preferredGroupId: params.get('join') || undefined, tip: tipValue,
        instructions: [...notes, ...(note.trim() ? [`Note: ${note.trim()}`] : [])],
        lines: cart.lines.map((l) => ({ merchantId: l.store.id, itemId: l.item.id, qty: l.qty })),
      });
      setPlacedId(r.groupId);
      nav(`/group/${r.groupId}`, { replace: true });
      setTimeout(() => cart.clear(), 0); // empty the cart only after we've left the checkout
      savePromo(null);
      toast(r.joinedExisting ? { title: 'You joined your neighbours', text: 'Your order shares their delivery.' } : { title: r.orders > 1 ? `Order placed with ${r.orders} shops` : 'Order placed', text: 'Complete your payment to confirm it.' });
    } catch (e) {
      toast({ kind: 'error', text: e.message });
      if (e.data?.groupId) nav(`/group/${e.data.groupId}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
      <PageHeader title="Checkout" />
      <div className="md:grid md:grid-cols-[1fr_360px] md:items-start md:gap-6">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Delivering to</h2>
              <button onClick={openLocation} className="text-xs font-semibold text-brand hover:underline">Change</button>
            </div>
            <div className="space-y-1.5 text-sm text-sub">
              <div className="flex items-center gap-2"><UserRound size={15} className="text-ink" />{user.name}</div>
              <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-ink" /><span>{[user.flat, user.address].filter(Boolean).join(', ')}</span></div>
            </div>
            <label className="mt-3 block text-xs font-medium text-sub">Phone for your delivery partner <span className="text-faint">(optional)</span></label>
            <input className="input mt-1 !py-2.5" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 16))} placeholder="So they can call if they can’t find you" />
          </div>

          <div className="card p-4">
            <h2 className="mb-3 font-bold">Delivery time</h2>
            <div className="grid grid-cols-3 gap-2">
              {WINDOWS.map(([m, l, d]) => (
                <button key={m} onClick={() => setWin(m)} className={`relative rounded-xl border p-3 text-left transition ${win === m ? 'border-brand bg-brand-soft' : 'border-line hover:bg-page'}`}>
                  {win === m && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white"><Check size={10} strokeWidth={3} /></span>}
                  <div className="text-sm font-semibold">{l}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-sub">{d}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="flex items-center gap-2 font-bold"><Heart size={16} className="text-danger" />Tip your delivery partner</h2>
            <p className="mt-0.5 text-xs text-sub">Your kindness means a lot! 100% of the tip goes to your delivery partner.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIPS.map((t) => (
                <button key={t} onClick={() => { setTip(t); setCustom(''); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${!custom && tip === t ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line hover:bg-page'}`}>{t ? `₹${t}` : 'No tip'}</button>
              ))}
              <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="Custom" className={`w-24 rounded-xl border px-3 py-2 text-sm outline-none ${custom ? 'border-brand' : 'border-line'}`} />
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">Delivery instructions</h2>
            <p className="mt-0.5 text-xs text-sub">Your shop and delivery partner will see these.</p>
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
              {INSTRUCTIONS.map(([t, Icon]) => (
                <button key={t} onClick={() => toggle(t)} className={`flex w-28 shrink-0 flex-col gap-2 rounded-xl border p-3 text-left text-xs font-medium transition ${notes.includes(t) ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line hover:bg-page'}`}>
                  <Icon size={18} />{t}
                </button>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="Anything else? e.g. Gate 2, call on arrival" className="input mt-3 !py-2.5" />
          </div>
        </div>

        <div className="mt-4 space-y-4 md:sticky md:top-24 md:mt-0">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Your items <span className="font-normal text-sub">({cart.count})</span></h2>
              <Link to="/cart" className="text-xs font-semibold text-brand">Edit</Link>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {cart.shops.map(({ store, lines }) => (
                <div key={store.id}>
                  <div className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-wide text-faint">{store.name}</div>
                  {lines.map(({ item, qty }) => (
                    <div key={item.id} className="flex items-center gap-2.5 py-1 text-sm">
                      <ProductImg item={item} kind={store.kind} className="h-9 w-9 border border-line bg-white" rounded="rounded-lg" />
                      <span className="min-w-0 flex-1 truncate">{qty} × {item.name}</span>
                      <span className="tnum">{item.approxPrice ? '≈' : ''}{inr(item.price * qty)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-1.5 pl-3">
              <Tag size={15} className="shrink-0 text-brand" />
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={promo ? `${promo.code} applied` : 'Promo code'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              {promo ? <button className="px-2 text-xs font-semibold text-danger" onClick={() => { setPromo(null); savePromo(null); }}>Remove</button>
                : <button className="rounded-lg bg-night px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40" disabled={!code} onClick={applyPromo}>Apply</button>}
            </div>
            <div className="mt-4 space-y-2">
              <Row label="Items total" value={`${cart.hasApprox ? '≈' : ''}${inr(cart.subtotal)}`} />
              {promoOff > 0 && <Row label={`Promo (${promo.code})`} value={`−${inr(promoOff)}`} green />}
              <Row label="Delivery charge" value={cart.shops.length > 1 ? `Shared · 1 rider` : 'Shared'} />
              {tipValue > 0 && <Row label="Delivery partner tip" value={inr(tipValue)} />}
              <div className="border-t border-dashed border-line pt-2"><Row label="To pay (before delivery share)" value={inr(cart.subtotal - promoOff + tipValue)} bold /></div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">We check for neighbours ordering nearby for a few minutes, then show your final bill. Pay once by UPI, card or wallet.</p>
            <button className="btn-primary mt-4 w-full !rounded-xl !py-3.5" disabled={busy} onClick={place}>{busy ? <Loader2 size={18} className="animate-spin" /> : 'Place order'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
