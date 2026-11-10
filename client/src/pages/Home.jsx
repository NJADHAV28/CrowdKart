import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock, MapPin, ShieldCheck, Star, Users, Zap } from 'lucide-react';
import { api } from '../api.js';
import { getSocket } from '../socket.js';
import { useApp } from '../App.jsx';
import { useData } from '../state/data.jsx';
import Countdown from '../components/Countdown.jsx';
import Rail from '../components/Rail.jsx';
import { Empty, ProductCard, StatusTag } from '../components/ui.jsx';
import { GROUPS, GroupIcon, placeGroup } from '../components/placeGroups.jsx';
import { BRAND_ROW, CATEGORIES, bestOffers } from '../lib/taxonomy.js';

const img = (slug) => `./products/${slug}.jpg`;

export default function Home() {
  const { user, openLocation } = useApp();
  const { stores, products, error, reload, loading } = useData();
  const [params] = useSearchParams();
  const joinId = params.get('join');
  const [radar, setRadar] = useState(null);
  const [past, setPast] = useState([]);
  const [brands, setBrands] = useState(null);

  const loadRadar = useCallback(() => api.get('/radar').then(setRadar).catch(() => {}), []);
  useEffect(() => {
    loadRadar();
    api.get('/orders/mine').then(setPast).catch(() => {});
    api.get(`/brands/search?q=${encodeURIComponent('chips')}`).then(setBrands).catch(() => setBrands(false));
    const s = getSocket();
    s?.on('radar:update', loadRadar);
    s?.on('opportunity', loadRadar);
    const t = setInterval(loadRadar, 20000);
    return () => { s?.off('radar:update', loadRadar); s?.off('opportunity', loadRadar); clearInterval(t); };
  }, [loadRadar]);

  const offers = useMemo(() => bestOffers(products || []), [products]);
  const rails = useMemo(() => CATEGORIES.map((c) => ({ ...c, items: offers.filter((p) => c.tags.includes(p.tag)) })).filter((c) => c.items.length), [offers]);
  const liveCats = useMemo(() => new Set(rails.map((r) => r.id)), [rails]);

  // "Order again": items from past orders, matched to what's on sale now
  const again = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const o of past) for (const it of o.items) {
      const k = `${o.store.id}:${it.itemId}`;
      if (seen.has(k) || !o.store.id) continue;
      seen.add(k);
      const live = (products || []).find((p) => p.store.id === o.store.id && p.id === it.itemId);
      out.push(live || { id: it.itemId, name: it.name, price: it.price, img: it.img, unit: it.unit, store: { id: o.store.id, name: o.store.name, kind: o.store.kind } });
    }
    return out.slice(0, 12);
  }, [past, products]);

  const opp = radar?.opportunities?.find((o) => o.groupId === joinId) || radar?.opportunities?.[0];
  const maxPct = stores?.[0]?.groupDiscount?.at(-1)?.pct || 12;
  const nearShops = useMemo(() => (stores || []).slice().sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99)).slice(0, 16), [stores]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 md:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0f2a1c] text-white">
        <div className="relative z-10 max-w-xl p-5 md:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-night"><Zap size={12} className="fill-current" />Neighbourhood delivery</span>
          <h1 className="mt-3 text-2xl font-extrabold leading-[1.1] sm:text-3xl md:mt-4 md:text-5xl">Groceries & food in minutes.<br /><span className="text-sun">Cheaper together.</span></h1>
          <p className="mt-2 max-w-md text-xs text-white/75 sm:text-sm md:mt-3 md:text-base">Order from any shop near you. When neighbours order too, one rider brings everything and you save up to {maxPct}%.</p>
          <div className="mt-4 flex flex-wrap gap-2 md:mt-6 md:gap-3">
            <a href="#categories" className="btn !px-4 !py-2.5 bg-sun text-night hover:brightness-95 md:!px-5 md:!py-3">Shop now <ArrowRight size={16} /></a>
            <Link to="/nearby" className="btn !px-4 !py-2.5 border border-white/25 text-white hover:bg-white/10 md:!px-5 md:!py-3"><MapPin size={16} />Shops on map</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 top-1/2 hidden -translate-y-1/2 grid-cols-3 gap-3 opacity-95 md:grid">
          {['bananas', 'margherita-pizza', 'broccoli', 'cappuccino', 'toned-milk', 'apples', 'masala-dosa', 'potato-chips', 'chocolate-cake'].map((s, i) => (
            <img key={s} src={img(s)} alt="" className={`h-32 w-32 rounded-3xl object-cover shadow-2xl ring-4 ring-white/10 lg:h-36 lg:w-36 ${i % 3 === 1 ? 'translate-y-8' : ''}`} />
          ))}
        </div>
      </section>

      {/* Promo cards */}
      <section className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
        <Promo to="/c/fruits-veg" bg="#d9f2d0" title="Fresh fruits & veggies" text="Farm-fresh, from the kirana next door" cta="Order now" photo="pomegranate" />
        <Promo to="/c/pharma" bg="#d6e8fb" title="Pharmacy at your doorstep" text="Medicines, first aid & wellness" cta="Order now" photo="hand-sanitizer" />
        <Promo to="/c/snacks" bg="#ffe9b8" title="Snacks & munchies" text="Chips, biscuits, cold drinks & more" cta="Order now" photo="potato-chips" />
      </section>

      {/* Live: my order / neighbours ordering now */}
      {radar?.mine?.map((g) => (
        <Link key={g.groupId} to={`/group/${g.groupId}`} className="rise-in mt-4 flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition hover:shadow-card">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Clock size={19} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Your order is in progress</span><span className="block text-xs text-sub">{g.participants > 1 ? `Sharing delivery with ${g.participants - 1} neighbour${g.participants > 2 ? 's' : ''}` : 'Checking for neighbours ordering nearby'}</span></span>
          <StatusTag status={g.status} />
        </Link>
      ))}
      {opp && (
        <div className="rise-in mt-4 flex items-center gap-3 rounded-2xl bg-brand p-4 text-white">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Users size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{opp.participants} neighbours are ordering right now</div>
            <div className="text-xs text-white/85">Order within <b className="tnum"><Countdown to={opp.closesAt} done="seconds" /></b> to share their rider and pay less for delivery.</div>
          </div>
        </div>
      )}

      {/* Categories */}
      <section id="categories" className="mt-8 scroll-mt-28">
        <h2 className="mb-3 text-lg font-bold md:text-xl">Shop by category</h2>
        <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className={`group flex flex-col items-center gap-1.5 text-center ${liveCats.size && !liveCats.has(c.id) ? 'opacity-45' : ''}`}>
              <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl p-2 transition group-hover:-translate-y-0.5 group-hover:shadow-card" style={{ background: c.bg }}>
                <img src={`./${c.img}`} alt="" loading="lazy" className="h-full w-full rounded-xl object-cover transition duration-300 group-hover:scale-105" />
              </span>
              <span className="line-clamp-2 text-[11px] font-semibold leading-tight md:text-xs">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {loading && <div className="mt-8 space-y-6">{[0, 1].map((r) => <div key={r}><div className="skeleton mb-3 h-6 w-48" /><div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-64 w-44 shrink-0" />)}</div></div>)}</div>}
      {!loading && error && <div className="mt-8"><Empty title="Couldn’t load shops" text={error} action={<button className="btn-primary mt-4" onClick={reload}>Try again</button>} /></div>}
      {!loading && !error && !offers.length && <div className="mt-8"><Empty title="No shops deliver here yet" text="Try a different address nearby." action={<button className="btn-primary mt-4" onClick={openLocation}>Change address</button>} /></div>}

      {again.length > 0 && (
        <Rail title="Order again" subtitle="From your past orders">
          {again.map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} compact />)}
        </Rail>
      )}

      {rails.slice(0, 3).map((c) => (
        <Rail key={c.id} title={c.label} to={`/c/${c.id}`}>
          {c.items.slice(0, 14).map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} compact />)}
        </Rail>
      ))}

      {brands && brands.shop && brands.products?.length > 0 && (
        <Rail title="Chips & namkeen from top brands" subtitle={`From ${brands.shop.name}, your nearest shop`} to="/search?q=chips">
          {brands.products.slice(0, 14).map((p) => <ProductCard key={p.id} item={p} store={brands.shop} compact />)}
        </Rail>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold md:text-xl">Popular brands</h2>
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {BRAND_ROW.map((b) => <Link key={b} to={`/search?q=${encodeURIComponent(b)}`} className="whitespace-nowrap rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand">{b}</Link>)}
        </div>
      </section>

      {rails.slice(3).map((c) => (
        <Rail key={c.id} title={c.label} to={`/c/${c.id}`}>
          {c.items.slice(0, 14).map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} compact />)}
        </Rail>
      ))}

      {nearShops.length > 0 && (
        <Rail title="Shops near you" subtitle={`${stores.length} shops deliver to ${user.area || 'you'}`} to="/nearby">
          {nearShops.map((s) => (
            <Link key={s.id} to={`/store/${s.id}`} className="flex w-60 shrink-0 items-center gap-3 rounded-2xl border border-line bg-white p-3 transition hover:shadow-card">
              <GroupIcon group={placeGroup(s)} size={52} radius={14} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-[11px] text-sub">{GROUPS[placeGroup(s)].one}</span>
                <span className="tnum mt-0.5 flex items-center gap-2 text-[11px] text-sub">{s.etaMin && <span className="inline-flex items-center gap-0.5"><Clock size={10} />{s.etaMin} mins</span>}<span>{s.distanceKm} km</span>{s.rating && <span className="inline-flex items-center gap-0.5 font-semibold text-ink"><Star size={10} className="fill-[#f5a623] text-[#f5a623]" />{s.rating.toFixed(1)}</span>}</span>
              </span>
            </Link>
          ))}
        </Rail>
      )}

      {/* Why CrowdKart */}
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        {[[Zap, 'Superfast delivery', 'Real road times from the shops around you.'], [Users, 'Cheaper with neighbours', `Share one rider and save up to ${maxPct}%.`], [ShieldCheck, 'Private by design', 'Neighbours never see your name, address or items.']].map(([Icon, t, d]) => (
          <div key={t} className="flex gap-3 rounded-2xl bg-white p-4 shadow-card">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-soft text-[#9a6b00]"><Icon size={20} /></span>
            <span><span className="block font-semibold">{t}</span><span className="block text-xs text-sub">{d}</span></span>
          </div>
        ))}
      </section>

      <footer className="mt-10 border-t border-line pt-6 text-xs text-sub">
        <div className="mb-3 font-semibold text-ink">Categories</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-5">
          {CATEGORIES.map((c) => <Link key={c.id} to={`/c/${c.id}`} className="hover:text-ink">{c.label}</Link>)}
        </div>
        <p className="mt-6 text-[11px] text-faint">© CrowdKart · Product photos: Wikimedia Commons and Open Food Facts contributors · Map data © OpenStreetMap contributors</p>
      </footer>
    </div>
  );
}

function Promo({ to, bg, title, text, cta, photo }) {
  return (
    <Link to={to} className="group relative flex h-40 w-72 shrink-0 overflow-hidden rounded-3xl p-5 transition hover:-translate-y-0.5 hover:shadow-card md:h-44 md:w-auto" style={{ background: bg }}>
      <span className="relative z-10 flex max-w-[60%] flex-col">
        <span className="text-lg font-extrabold leading-tight">{title}</span>
        <span className="mt-1 text-xs text-ink/70">{text}</span>
        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-lg bg-night px-3 py-1.5 text-xs font-bold text-white">{cta}<ArrowRight size={13} /></span>
      </span>
      <img src={img(photo)} alt="" className="absolute -bottom-3 -right-3 h-36 w-36 rounded-full object-cover shadow-xl ring-8 ring-white/50 transition duration-300 group-hover:scale-105 md:h-40 md:w-40" />
    </Link>
  );
}
