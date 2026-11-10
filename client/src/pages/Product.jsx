import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, Heart, MapPin, Star, Users } from 'lucide-react';
import { api, inr } from '../api.js';
import { useApp } from '../App.jsx';
import { useCart } from '../state/cart.jsx';
import { useData } from '../state/data.jsx';
import { BackButton, ProductCard, ProductImg, SectionHeader, Stepper, storeSubtitle } from '../components/ui.jsx';

export default function Product() {
  const { storeId, itemId } = useParams();
  const { toast } = useApp();
  const nav = useNavigate();
  const cart = useCart();
  const { products } = useData();
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('details');
  const [qty, setQty] = useState(1);
  const [brand, setBrand] = useState(null);
  const isBrand = String(itemId).startsWith('off:');

  useEffect(() => {
    setQty(1); setTab('details'); setBrand(null);
    api.get(`/merchants/${storeId}`).then(setS).catch((e) => { toast({ kind: 'error', text: e.message }); nav('/'); });
    if (String(itemId).startsWith('off:')) api.get(`/brands/${encodeURIComponent(itemId)}`).then((r) => setBrand({ ...r.product, approxPrice: !r.product.priceExact })).catch(() => setBrand(false));
  }, [storeId, itemId, toast, nav]);

  const item = isBrand ? brand || null : s?.items.find((i) => i.id === itemId);
  const related = useMemo(() => {
    if (!item) return [];
    const sameStore = (s.items || []).filter((i) => i.id !== item.id && i.tag === item.tag).map((i) => ({ ...i, store: { id: s.id, name: s.name, kind: s.kind } }));
    const elsewhere = (products || []).filter((p) => p.tag === item.tag && !(p.store.id === s.id));
    return [...sameStore, ...elsewhere].slice(0, 4);
  }, [item, s, products]);

  if (!s || (isBrand && brand === null)) return <div className="p-4"><div className="skeleton aspect-square w-full md:aspect-[2/1]" /><div className="skeleton mt-4 h-24" /></div>;
  if (!item) return <div className="p-6 text-center text-sub">This item is no longer available.</div>;
  const store = { id: s.id, name: s.name, kind: s.kind };
  const inCart = cart.qtyOf(s.id, item.id);
  const favKey = `${s.id}:${item.id}`;

  return (
    <div className="md:px-6 md:pt-6">
      <div className="md:grid md:grid-cols-2 md:gap-8">
        <div className="relative">
          <ProductImg item={item} kind={s.kind} rounded="rounded-b-[32px] md:rounded-[32px]" className="aspect-square w-full bg-white" />
          <div className="absolute inset-x-4 top-4 flex justify-between">
            <div className="relative h-10 w-10"><BackButton /></div>
            <button onClick={() => cart.toggleFav(favKey, { item, store })} aria-label="Favourite" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card">
              <Heart size={18} className={cart.isFav(favKey) ? 'fill-danger text-danger' : ''} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-5 md:px-0">
          <h1 className="text-[22px] font-semibold leading-tight">{item.name}{item.unit ? <span className="text-base font-normal text-sub"> · {item.unit}</span> : null}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sub">
            {s.rating && <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 font-semibold text-white"><Star size={11} className="fill-current" />{s.rating.toFixed(1)}</span>}
            <span>Seller: <Link to={`/store/${s.id}`} className="font-medium text-ink hover:underline">{s.name}</Link></span>
            <span>·</span><span>{storeSubtitle(s)}</span>
          </div>
          <div className="tnum mt-3 text-2xl font-bold">{item.approxPrice ? '≈ ' : ''}{inr(item.price)}</div>
          {item.approxPrice && <p className="text-[11px] text-faint">Estimated from the pack size. The shop confirms the MRP.</p>}
          {isBrand && <p className="mt-1 text-xs text-sub">Comes from your nearest shop: <b className="text-ink">{s.name}</b>{s.distanceKm != null ? ` (${s.distanceKm} km)` : ''}</p>}

          <div className="mt-5 flex rounded-full bg-white p-1 shadow-card">
            {[['details', 'Details'], ['delivery', 'Delivery'], ['store', 'Store']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-2 text-xs font-medium transition ${tab === k ? 'bg-brand text-white' : 'text-sub'}`}>{l}</button>
            ))}
          </div>
          <div className="mt-4 min-h-20 text-sm leading-relaxed text-sub">
            {tab === 'details' && <p>{item.desc || `${item.name} from ${s.name}.`}{item.tag ? ` Category: ${item.tag}.` : ''}</p>}
            {tab === 'delivery' && (
              <ul className="space-y-2">
                {s.etaMin && <li className="flex items-center gap-2"><Clock size={15} className="text-brand" />Arrives in about {s.etaMin}–{s.etaMin + 8} minutes</li>}
                <li className="flex items-center gap-2"><Users size={15} className="text-brand" />Share a rider with neighbours ordering at the same time and pay less for delivery</li>
                {s.groupDiscount?.length > 0 && <li className="flex items-center gap-2"><Star size={15} className="text-brand" />Up to {s.groupDiscount.at(-1).pct}% off when neighbours order from {s.name} too</li>}
              </ul>
            )}
            {tab === 'store' && (
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-brand" />{s.address || 'Address not listed'}{s.distanceKm != null ? ` · ${s.distanceKm} km away` : ''}</li>
                {s.openingHours && <li className="flex items-center gap-2"><Clock size={15} className="text-brand" />{s.openingHours}</li>}
                <li><Link to={`/store/${s.id}`} className="btn-text">See everything from this store</Link></li>
              </ul>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
            <Stepper value={qty} onChange={(v) => setQty(Math.max(1, v))} />
            <button className="btn-primary flex-1 !py-3.5" onClick={() => { cart.add(item, store, qty); toast(`${item.name} added to cart`); }}>
              {inCart ? 'Add more' : 'Add to cart'} · {inr(item.price * qty)}
            </button>
          </div>
          {inCart > 0 && <Link to="/cart" className="mt-2 block text-center text-xs font-medium text-brand">{inCart} in cart · View cart</Link>}
        </div>
      </div>

      {related.length > 0 && (
        <div className="px-4 md:px-0">
          <SectionHeader title="You Might Also Like" to={`/explore?tag=${encodeURIComponent(item.tag || '')}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} />)}
          </div>
        </div>
      )}
    </div>
  );
}
