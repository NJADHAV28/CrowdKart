import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Search, ShoppingCart, UserRound } from 'lucide-react';
import { inr } from '../api.js';
import { useApp } from '../App.jsx';
import { useCart } from '../state/cart.jsx';
import { useData } from '../state/data.jsx';
import { SEARCH_HINTS } from '../lib/taxonomy.js';
import { Logo } from './ui.jsx';

/** Sticky top bar: delivery promise + address, live search, account and cart. */
export default function Header() {
  const { user, openLocation } = useApp();
  const cart = useCart();
  const { stores } = useData();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onSearch = pathname === '/search';
  const [q, setQ] = useState(onSearch ? params.get('q') || '' : '');
  const [hint, setHint] = useState(0);

  useEffect(() => { const t = setInterval(() => setHint((h) => (h + 1) % SEARCH_HINTS.length), 2600); return () => clearInterval(t); }, []);
  useEffect(() => { if (!onSearch) setQ(''); }, [onSearch]);

  // Fastest shop's delivery time = the promise in the header
  const fastest = stores?.length ? Math.min(...stores.map((s) => s.etaMin || 99)) : null;
  const go = (v) => nav(`/search?q=${encodeURIComponent(v)}`, { replace: onSearch });

  const searchBox = (
    <div className="relative w-full">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sub" />
      <input
        value={q}
        onFocus={() => !onSearch && nav('/search')}
        onChange={(e) => { setQ(e.target.value); go(e.target.value); }}
        aria-label="Search for products and shops"
        className="h-12 w-full rounded-xl border border-line bg-[#f8f8f6] pl-11 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-3 focus:ring-brand/10"
      />
      {!q && (
        <span className="pointer-events-none absolute left-11 top-1/2 h-5 -translate-y-1/2 overflow-hidden text-sm text-faint">
          Search “<span key={hint} className="hint-roll">{SEARCH_HINTS[hint]}</span>”
        </span>
      )}
    </div>
  );

  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-6 md:px-6">
        <Link to="/" className="hidden shrink-0 md:block"><Logo /></Link>
        <button onClick={openLocation} className="min-w-0 shrink-0 text-left md:w-56">
          <div className="text-[15px] font-extrabold leading-tight md:text-base">{fastest ? `Delivery in ${fastest} minutes` : 'Delivery to'}</div>
          <div className="flex items-center gap-0.5 text-xs text-sub"><span className="max-w-[46vw] truncate md:max-w-48">{[user.flat, user.area].filter(Boolean).join(', ') || 'Set your location'}</span><ChevronDown size={14} className="shrink-0" /></div>
        </button>
        <div className="hidden flex-1 md:block">{searchBox}</div>
        <Link to="/account" className="ml-auto hidden items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-ink md:flex"><UserRound size={18} />Account</Link>
        <Link to="/account" aria-label="Account" className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-page md:hidden"><UserRound size={19} /></Link>
        <button onClick={() => cart.setOpen(true)} className={`hidden h-12 items-center gap-2.5 rounded-xl px-4 text-sm font-bold text-white transition md:flex ${cart.count ? 'bg-brand hover:bg-brand-dark' : 'bg-[#c9cdca] hover:bg-[#b9beba]'}`}>
          <ShoppingCart size={20} key={cart.bump} className={cart.bump ? 'pop' : ''} />
          {cart.count ? <span className="text-left leading-tight"><span className="block text-xs font-semibold">{cart.count} {cart.count === 1 ? 'item' : 'items'}</span><span className="tnum block">{inr(cart.subtotal)}</span></span> : 'My Cart'}
        </button>
      </div>
      <div className="px-4 pb-3 md:hidden">{searchBox}</div>
    </header>
  );
}
