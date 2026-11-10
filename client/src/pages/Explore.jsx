import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useData } from '../state/data.jsx';
import { Empty, PageHeader, ProductCard, StoreIcon, storeSubtitle } from '../components/ui.jsx';

/** "See All Items": search + category tabs across every store that delivers to you. */
export default function Explore() {
  const { products, stores, tags, loading } = useData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const tag = params.get('tag') || '';
  const view = params.get('view') || 'items';
  const set = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const term = q.trim().toLowerCase();
  const items = useMemo(() => (products || []).filter((p) => (!tag || p.tag === tag)
    && (!term || `${p.name} ${p.tag} ${p.store.name}`.toLowerCase().includes(term))), [products, tag, term]);
  const shops = useMemo(() => (stores || []).filter((s) => !term || `${s.name} ${s.cuisine || ''}`.toLowerCase().includes(term)), [stores, term]);

  return (
    <div className="px-4 pt-4 md:px-6">
      <PageHeader title="See All Items" back="/" />
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input !rounded-full !py-3.5 !pl-11 shadow-card !border-transparent" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" autoFocus={!!params.get('q')} />
      </div>

      <div className="mt-4 flex gap-6 border-b border-line text-sm">
        {[['items', 'Shop items'], ['brands', 'Brands'], ['stores', 'Stores']].map(([k, l]) => (
          <button key={k} onClick={() => set('view', k === 'items' ? '' : k)} className={`-mb-px border-b-2 pb-2.5 font-medium ${view === k ? 'border-brand text-brand' : 'border-transparent text-sub'}`}>{l}</button>
        ))}
      </div>

      {view === 'brands' && <Brands q={q} />}

      {view === 'items' && (
        <>
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
            <Chip active={!tag} onClick={() => set('tag', '')}>All</Chip>
            {tags.map((t) => <Chip key={t} active={tag === t} onClick={() => set('tag', t)}>{t}</Chip>)}
          </div>
          <div className="mt-2 text-xs text-sub">{loading ? 'Loading…' : `${items.length} items`}</div>
          {loading && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div>}
          {!loading && !items.length && <div className="mt-4"><Empty title="Nothing found" text="Try another word or category." /></div>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} />)}
          </div>
        </>
      )}

      {view === 'stores' && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {shops.map((s) => (
            <Link key={s.id} to={`/store/${s.id}`} className="card flex items-center gap-3.5 p-3.5">
              <StoreIcon kind={s.kind} size={56} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="truncate text-xs text-sub">{storeSubtitle(s)}{s.address ? ` · ${s.address}` : ''}</div>
                <div className="tnum mt-0.5 text-xs text-sub">{s.etaMin ? `${s.etaMin}–${s.etaMin + 8} min · ` : ''}{s.distanceKm} km{s.rating ? ` · ★ ${s.rating.toFixed(1)}` : ''}</div>
              </div>
            </Link>
          ))}
          {!loading && !shops.length && <Empty title="No stores found" />}
        </div>
      )}
    </div>
  );
}

const Chip = ({ active, children, ...p }) => (
  <button {...p} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition ${active ? 'bg-brand text-white' : 'bg-white text-ink shadow-card hover:bg-brand-soft'}`}>{children}</button>
);

const QUICK = ["Lay's", 'Maggi', 'Amul', 'Parle-G', 'Britannia', 'Cadbury', 'Kurkure', 'Haldiram', 'Coca-Cola', 'Tata Tea', 'Nescafe', 'Bisleri'];

/** Any packaged product (Open Food Facts), supplied by the nearest shop that delivers to you. */
function Brands({ q }) {
  const [term, setTerm] = useState(q.trim() || '');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (q.trim().length >= 2) setTerm(q.trim()); }, [q]);
  useEffect(() => {
    if (term.length < 2) { setRes(null); return undefined; }
    let live = true;
    setRes('loading'); setErr('');
    const t = setTimeout(() => {
      api.get(`/brands/search?q=${encodeURIComponent(term)}`)
        .then((r) => live && setRes(r))
        .catch((e) => { if (live) { setErr(e.message); setRes(null); } });
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [term]);

  return (
    <div className="mt-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
        {QUICK.map((b) => <Chip key={b} active={term.toLowerCase() === b.toLowerCase()} onClick={() => setTerm(b)}>{b}</Chip>)}
      </div>
      {!term && <p className="mt-4 text-sm text-sub">Search any brand or packaged product above, or tap a popular one.</p>}
      {res === 'loading' && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div>}
      {err && <div className="mt-4"><Empty title="Couldn’t search right now" text={err} /></div>}
      {res && res !== 'loading' && (
        <>
          {res.shop
            ? <p className="mt-3 text-xs text-sub">These come from <b className="text-ink">{res.shop.name}</b>{res.shop.distanceKm != null ? `, ${res.shop.distanceKm} km away` : ''}, your nearest shop. ≈ prices are estimates; the shop confirms the MRP.</p>
            : <p className="mt-3 text-xs text-danger">No grocery shop delivers to your address yet.</p>}
          {!res.products.length && <div className="mt-4"><Empty title="No products found" text="Try a different spelling or brand." /></div>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {res.shop && res.products.map((p) => <ProductCard key={p.id} item={p} store={res.shop} showShop={false} />)}
          </div>
          {res.products.length > 0 && <p className="mt-4 text-center text-[10px] text-faint">Product data and photos: Open Food Facts contributors (openfoodfacts.org)</p>}
        </>
      )}
    </div>
  );
}
