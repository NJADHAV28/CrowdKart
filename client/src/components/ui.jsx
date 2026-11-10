import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Beef, ChevronRight, Coffee, Croissant, Heart, IceCreamCone, Minus, PencilLine, Pill, Pizza, Plus, Sandwich, Shirt, ShoppingBasket, Smartphone, Soup, UtensilsCrossed,
} from 'lucide-react';
import { useCart } from '../state/cart.jsx';
import { inr, serverUrl } from '../api.js';

const KIND = {
  pizza: [Pizza, '#fdecea', '#c0392b'], burger: [Beef, '#fdf0e4', '#c2611d'], chinese: [Soup, '#fdf3e1', '#b7791f'],
  cafe: [Coffee, '#f3ede7', '#7b5a3c'], bakery: [Croissant, '#fbf1e3', '#a8652a'], snacks: [Sandwich, '#fdf5e0', '#a36b00'],
  indian: [UtensilsCrossed, '#fdeee6', '#b8461b'], icecream: [IceCreamCone, '#fbeef4', '#b0457a'],
  grocery: [ShoppingBasket, '#e7f5ed', '#2fa866'], pharmacy: [Pill, '#e9f1fb', '#1d5fae'], stationery: [PencilLine, '#eef0fa', '#4b4fb0'],
  electronics: [Smartphone, '#ecf0f3', '#3d5466'], fashion: [Shirt, '#f4ecf8', '#7c3aa0'], food: [UtensilsCrossed, '#fdeee6', '#b8461b'],
};
export const kindInfo = (k) => KIND[k] || KIND.grocery;

export function StoreIcon({ kind, size = 48, radius = 14 }) {
  const [Icon, bg, fg] = kindInfo(kind);
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: radius, background: bg, color: fg }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </div>
  );
}

/** Product photo with a graceful icon fallback (for merchant-added items without a photo). */
export function ProductImg({ item, kind, className = '', rounded = 'rounded-xl' }) {
  const [broken, setBroken] = useState(false);
  if (!item?.img || broken) {
    const [Icon, bg, fg] = kindInfo(kind);
    return <div className={`flex items-center justify-center ${rounded} ${className}`} style={{ background: bg, color: fg }}><Icon size={30} strokeWidth={1.6} /></div>;
  }
  // Bundled photos live in the app; proxied brand photos (img/…) come from the server.
  const src = item.img.startsWith('http') ? item.img : item.img.startsWith('img/') ? `${serverUrl()}/${item.img}` : `./${item.img}`;
  return <img src={src} alt={item.name} loading="lazy" decoding="async" onError={() => setBroken(true)} className={`object-cover ${rounded} ${className}`} />;
}

export function Stepper({ value, onChange, size = 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  return (
    <div className="inline-flex items-center gap-2.5">
      <button className={`flex ${s} items-center justify-center rounded-full border border-line bg-white text-ink hover:border-ink/40`} onClick={() => onChange(value - 1)} aria-label="Remove one"><Minus size={14} strokeWidth={2.5} /></button>
      <span className="tnum min-w-4 text-center text-sm font-semibold">{value}</span>
      <button className={`flex ${s} items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark disabled:opacity-40`} disabled={value >= 20} onClick={() => onChange(value + 1)} aria-label="Add one"><Plus size={14} strokeWidth={2.5} /></button>
    </div>
  );
}

/** Product tile used in grids (Popular items, store menus, search). */
export function ProductCard({ item, store, showShop = false, compact = false }) {
  const cart = useCart();
  const qty = cart.qtyOf(store.id, item.id);
  const approx = item.priceExact === false || item.approxPrice;
  const cartItem = approx ? { ...item, approxPrice: true } : item;
  const favKey = `${store.id}:${item.id}`;
  return (
    <div className={`group relative flex h-full flex-col rounded-2xl border border-line bg-white p-2.5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,26,20,.10)] ${compact ? 'w-[9.5rem] shrink-0 sm:w-44' : ''}`}>
      <Link to={`/p/${store.id}/${encodeURIComponent(item.id)}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f7f7f5]">
          <ProductImg item={item} kind={store.kind} className="h-full w-full transition duration-300 group-hover:scale-[1.04]" />
        </div>
        {store.etaMin ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-page px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/80">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {store.etaMin} mins
          </span>
        ) : <span className="mt-2 block h-[18px]" />}
        <div className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-tight">{item.name}</div>
        <div className="mt-1 line-clamp-1 text-[11px] text-sub">{item.unit || item.tag}{showShop ? ` · ${store.name}` : ''}</div>
      </Link>
      <button onClick={() => cart.toggleFav(favKey, { item, store })} aria-label="Save to favourites"
        className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm transition group-hover:opacity-100 data-[on=true]:opacity-100" data-on={cart.isFav(favKey)}>
        <Heart size={14} className={cart.isFav(favKey) ? 'fill-danger text-danger' : 'text-sub'} />
      </button>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
        <span className="tnum text-[13px] font-bold" title={approx ? 'Approximate price; the shop confirms the MRP' : undefined}>{approx ? '≈' : ''}{inr(item.price)}</span>
        {qty
          ? <QtyPill value={qty} onChange={(v) => cart.setQty(store.id, item.id, v)} />
          : <button onClick={() => cart.add(cartItem, store)} aria-label={`Add ${item.name}`}
              className="h-8 min-w-[4.25rem] rounded-lg border border-brand bg-brand-soft/60 px-3 text-xs font-bold text-brand transition hover:bg-brand hover:text-white active:scale-95">ADD</button>}
      </div>
    </div>
  );
}

/** Green quantity pill (− n +) used on product cards and in the cart. */
export function QtyPill({ value, onChange, size = 'md' }) {
  const h = size === 'sm' ? 'h-7' : 'h-8';
  return (
    <div className={`inline-flex ${h} min-w-[4.25rem] items-center justify-between rounded-lg bg-brand text-white shadow-sm`}>
      <button className="flex h-full w-6 items-center justify-center rounded-l-lg hover:bg-black/10" onClick={() => onChange(value - 1)} aria-label="Remove one"><Minus size={13} strokeWidth={3} /></button>
      <span className="tnum min-w-4 px-1 text-center text-xs font-bold">{value}</span>
      <button className="flex h-full w-6 items-center justify-center rounded-r-lg hover:bg-black/10" onClick={() => onChange(value + 1)} aria-label="Add one"><Plus size={13} strokeWidth={3} /></button>
    </div>
  );
}

export function SectionHeader({ title, to, action = 'View All' }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {to && <Link to={to} className="inline-flex items-center text-xs font-medium text-sub hover:text-ink">{action}<ChevronRight size={14} /></Link>}
    </div>
  );
}

export function Row({ label, value, green, bold }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${bold ? 'text-base font-semibold' : 'text-sm'}`}>
      <span className={bold ? '' : 'text-sub'}>{label}</span>
      <span className={`tnum ${green ? 'text-brand' : ''}`}>{value}</span>
    </div>
  );
}

const STATUS = {
  open: ['Finding neighbours', 'bg-warn-soft text-warn'],
  matching: ['Finding neighbours', 'bg-warn-soft text-warn'],
  awaiting_payment: ['Awaiting payment', 'bg-warn-soft text-warn'],
  paid: ['Confirmed', 'bg-brand-soft text-brand'],
  in_transit: ['Out for delivery', 'bg-brand-soft text-brand'],
  delivered: ['Delivered', 'bg-page text-sub'],
  cancelled: ['Cancelled', 'bg-page text-faint'],
};
export function StatusTag({ status }) {
  const [t, c] = STATUS[status] || [status, 'bg-page text-sub'];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c}`}>{t}</span>;
}

export function PageHeader({ title, back = -1, right }) {
  return (
    <div className="relative mb-5 flex h-10 items-center justify-center">
      {back !== null && <BackButton to={back} />}
      <h1 className="text-base font-semibold">{title}</h1>
      {right && <div className="absolute right-0">{right}</div>}
    </div>
  );
}

export function BackButton({ to = -1 }) {
  return (
    <button onClick={() => (typeof to === 'number' ? window.history.go(to) : (location.hash = `#${to}`))} aria-label="Back"
      className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card hover:bg-page">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
  );
}

export function Logo({ light = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[19px] font-bold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h2.2l2.1 9.2h9.4l2.1-6.7H7" /><circle cx="9.5" cy="19" r="1.4" fill="currentColor" /><circle cx="16.5" cy="19" r="1.4" fill="currentColor" /></svg>
      </span>
      <span>crowd<span className="text-brand">kart</span></span>
    </span>
  );
}

export const storeSubtitle = (s) => {
  const c = (s.cuisine || '').split(/[;\s]/)[0].replace(/_/g, ' ');
  if (s.category === 'food') return c && !['regional', 'restaurant'].includes(c) ? c[0].toUpperCase() + c.slice(1) : 'Restaurant';
  return { grocery: 'Grocery', pharmacy: 'Pharmacy', stationery: 'Stationery', electronics: 'Electronics', fashion: 'Clothing' }[s.category] || 'Store';
};

export function Empty({ title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand"><ShoppingBasket size={24} /></div>
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-sub">{text}</p>}
      {action}
    </div>
  );
}
