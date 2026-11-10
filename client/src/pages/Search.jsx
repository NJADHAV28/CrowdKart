import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Search as SearchIcon, TrendingUp } from 'lucide-react';
import { api } from '../api.js';
import { useData } from '../state/data.jsx';
import { Empty, ProductCard } from '../components/ui.jsx';
import { GROUPS, GroupIcon, placeGroup } from '../components/placeGroups.jsx';
import { CATEGORIES, SEARCH_HINTS, bestOffers } from '../lib/taxonomy.js';

const RECENT = 'ck_recent_searches';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT)) || []; } catch { return []; } };

/** Instant search across shop items, branded products and shops (query comes from the header box). */
export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const { products, stores } = useData();
  const [brand, setBrand] = useState(null);
  const [recent, setRecent] = useState(readRecent());

  const term = q.toLowerCase();
  const items = useMemo(() => (term.length < 2 ? [] : bestOffers(products || []).filter((p) => `${p.name} ${p.tag} ${p.store.name}`.toLowerCase().includes(term)).slice(0, 40)), [products, term]);
  const shops = useMemo(() => (term.length < 2 ? [] : (stores || []).filter((s) => `${s.name} ${s.cuisine || ''}`.toLowerCase().includes(term)).slice(0, 12)), [stores, term]);

  // Branded packaged products (Open Food Facts), debounced so we don't search on every key
  useEffect(() => {
    setBrand(null);
    if (term.length < 3) return undefined;
    let live = true;
    const t = setTimeout(() => {
      setBrand('loading');
      api.get(`/brands/search?q=${encodeURIComponent(term)}`).then((r) => live && setBrand(r)).catch(() => live && setBrand(false));
      const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== term)].slice(0, 8);
      try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch { /* ignore */ }
      setRecent(next);
    }, 700);
    return () => { live = false; clearTimeout(t); };
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6">
        {recent.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2.5 text-sm font-bold">Recent searches</h2>
            <div className="flex flex-wrap gap-2">{recent.map((r) => <Link key={r} to={`/search?q=${encodeURIComponent(r)}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:border-brand"><Clock size={13} className="text-faint" />{r}</Link>)}</div>
          </section>
        )}
        <section className="mb-6">
          <h2 className="mb-2.5 text-sm font-bold">Trending near you</h2>
          <div className="flex flex-wrap gap-2">{SEARCH_HINTS.map((r) => <Link key={r} to={`/search?q=${encodeURIComponent(r)}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:border-brand"><TrendingUp size={13} className="text-brand" />{r}</Link>)}</div>
        </section>
        <h2 className="mb-3 text-sm font-bold">Browse categories</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="flex flex-col items-center gap-1 text-center">
              <span className="aspect-square w-full overflow-hidden rounded-2xl p-1.5" style={{ background: c.bg }}><img src={`./${c.img}`} alt="" className="h-full w-full rounded-xl object-cover" /></span>
              <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{c.label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const brandList = brand && brand !== 'loading' && brand.shop ? brand.products : [];
  const nothing = !items.length && !shops.length && brand !== 'loading' && !brandList.length;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
      <p className="text-sm text-sub">Showing results for <b className="text-ink">“{q}”</b></p>
      {nothing && <div className="mt-4"><Empty title={`No results for “${q}”`} text="Check the spelling or try a broader word, like “milk” or “chips”." /></div>}

      {items.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 text-base font-bold">From shops near you <span className="font-normal text-sub">({items.length})</span></h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{items.map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} showShop />)}</div>
        </section>
      )}

      {(brand === 'loading' || brandList.length > 0) && (
        <section className="mt-8">
          <h2 className="text-base font-bold">Branded products</h2>
          {brand?.shop && <p className="mb-3 text-xs text-sub">Delivered from {brand.shop.name}, your nearest shop · ≈ prices are estimates, the shop confirms the MRP</p>}
          {brand === 'loading'
            ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-64" />)}</div>
            : <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{brandList.map((p) => <ProductCard key={p.id} item={p} store={brand.shop} />)}</div>}
          {brandList.length > 0 && <p className="mt-3 text-center text-[10px] text-faint">Product data and photos: Open Food Facts contributors</p>}
        </section>
      )}

      {shops.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">Shops</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <Link key={s.id} to={`/store/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 hover:shadow-card">
                <GroupIcon group={placeGroup(s)} size={46} radius={12} />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block truncate text-xs text-sub">{GROUPS[placeGroup(s)].one} · {s.distanceKm} km{s.etaMin ? ` · ${s.etaMin} mins` : ''}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="h-6" />
      <SearchIcon className="hidden" />
    </div>
  );
}
