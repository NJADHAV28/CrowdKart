import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useData } from '../state/data.jsx';
import { Empty, ProductCard } from '../components/ui.jsx';
import { CATEGORIES, bestOffers, categoryById } from '../lib/taxonomy.js';

const SORTS = [['relevance', 'Relevance'], ['price-asc', 'Price (low to high)'], ['price-desc', 'Price (high to low)'], ['fast', 'Fastest delivery'], ['az', 'Name (A–Z)']];

/** Category page: subcategory rail on the left, products on the right (like a quick-commerce aisle). */
export default function Category() {
  const { id } = useParams();
  const cat = categoryById(id);
  const { products, loading } = useData();
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('relevance');

  const offers = useMemo(() => bestOffers(products || []).filter((p) => cat?.tags.includes(p.tag)), [products, cat]);
  const subs = useMemo(() => cat?.tags.map((t) => ({ tag: t, first: offers.find((p) => p.tag === t), n: offers.filter((p) => p.tag === t).length })).filter((s) => s.n) || [], [cat, offers]);
  const shown = useMemo(() => {
    const list = offers.filter((p) => !tag || p.tag === tag);
    const by = {
      'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price,
      fast: (a, b) => (a.store.etaMin ?? 99) - (b.store.etaMin ?? 99), az: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return by ? [...list].sort(by) : list;
  }, [offers, tag, sort]);

  if (!cat) return <Navigate to="/" replace />;
  const idx = CATEGORIES.findIndex((c) => c.id === id);

  return (
    <div className="mx-auto max-w-7xl md:px-6 md:pt-4">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 md:rounded-t-2xl">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" className="rounded-full p-1 hover:bg-page" aria-label="Back"><ChevronLeft size={20} /></Link>
          <h1 className="truncate text-base font-bold md:text-lg">{cat.label}</h1>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-brand" aria-label="Sort products">
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {/* Other categories, quick switch */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2 md:hidden">
        {CATEGORIES.map((c, i) => <Link key={c.id} to={`/c/${c.id}`} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${i === idx ? 'bg-brand text-white' : 'bg-page'}`}>{c.label}</Link>)}
      </div>

      <div className="flex min-h-[70vh] bg-white md:rounded-b-2xl">
        <aside className="w-20 shrink-0 border-r border-line md:w-56">
          <div className="sticky top-[132px] max-h-[calc(100vh-140px)] overflow-y-auto md:top-[84px] md:max-h-[calc(100vh-92px)]">
            {[{ tag: '', first: offers[0], n: offers.length }, ...subs].map((s) => (
              <button key={s.tag || 'all'} onClick={() => setTag(s.tag)}
                className={`relative flex w-full flex-col items-center gap-1 px-1.5 py-3 text-center text-[10px] leading-tight transition md:flex-row md:gap-3 md:px-4 md:text-left md:text-sm ${tag === s.tag ? 'bg-brand-soft/60 font-semibold text-ink' : 'text-sub hover:bg-page'}`}>
                {tag === s.tag && <span className="absolute right-0 top-2 h-[calc(100%-16px)] w-1 rounded-l bg-brand" />}
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f1]">{s.first?.img && <img src={s.first.img.startsWith('http') ? s.first.img : `./${s.first.img}`} alt="" className="h-full w-full object-cover" />}</span>
                <span>{s.tag || 'All'}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 bg-page p-2.5 md:p-4">
          {loading && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-64" />)}</div>}
          {!loading && !shown.length && <Empty title="Nothing here yet" text="Shops near you don’t list items in this category." />}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => <ProductCard key={`${p.store.id}:${p.id}`} item={p} store={p.store} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
