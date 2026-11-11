import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Bike, ChevronRight, House, LayoutGrid, ReceiptText, ShoppingCart, Store as StoreIcon, UserRound, X } from 'lucide-react';
import { inr, serverUrl } from './api.js';
import Header from './components/Header.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import { api, getToken, getUser, setSession } from './api.js';
import { getSocket, closeSocket } from './socket.js';
import { CartProvider, useCart } from './state/cart.jsx';
import { DataProvider } from './state/data.jsx';

// Pages load on demand so the first screen opens fast.
const Login = lazy(() => import('./pages/Login.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const Explore = lazy(() => import('./pages/Explore.jsx'));
const Nearby = lazy(() => import('./pages/Nearby.jsx'));
const Category = lazy(() => import('./pages/Category.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const Store = lazy(() => import('./pages/Store.jsx'));
const Product = lazy(() => import('./pages/Product.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Group = lazy(() => import('./pages/Group.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Favorites = lazy(() => import('./pages/Favorites.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Merchant = lazy(() => import('./pages/Merchant.jsx'));
const Rider = lazy(() => import('./pages/Rider.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const LocationPicker = lazy(() => import('./components/LocationPicker.jsx'));

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export default function App() {
  const [user, setUserState] = useState(getUser());
  const [config, setConfig] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [configError, setConfigError] = useState(null);
  const [locOpen, setLocOpen] = useState(false);

  const loadConfig = useCallback(() => {
    setConfigError(null);
    api.get('/config').then(setConfig).catch((e) => setConfigError(e.message));
  }, []);
  useEffect(loadConfig, [loadConfig]);

  const toast = useCallback((t) => {
    const item = { id: Math.random().toString(36).slice(2), ...(typeof t === 'string' ? { text: t } : t) };
    setToasts((x) => [...x.slice(-2), item]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== item.id)), item.action ? 10000 : 3500);
  }, []);

  const setUser = (u) => { setSession(getToken(), u); setUserState(u); };
  const login = (token, u) => { setSession(token, u); setUserState(u); };
  const logout = () => { setSession(null); closeSocket(); setUserState(null); };

  return (
    <Ctx.Provider value={{ user, setUser, config, reloadConfig: loadConfig, configError, toast, login, logout, openLocation: () => setLocOpen(true) }}>
      <CartProvider>
        <DataProvider user={user}>
          <HashRouter>
            <SocketBridge />
            <Suspense fallback={<PageSpinner />}>
              <Shell />
            </Suspense>
            {locOpen && <LocationSheet onClose={() => setLocOpen(false)} />}
            <Toasts toasts={toasts} dismiss={(tid) => setToasts((x) => x.filter((y) => y.id !== tid))} />
          </HashRouter>
        </DataProvider>
      </CartProvider>
    </Ctx.Provider>
  );
}

const PageSpinner = () => <div className="flex h-60 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-brand border-t-transparent" /></div>;

function SocketBridge() {
  const { user, toast } = useApp();
  const nav = useNavigate();
  useEffect(() => {
    if (!user) return undefined;
    const s = getSocket();
    if (!s) return undefined;
    const onOpp = (o) => {
      if (user.role !== 'customer') return;
      toast({ title: `${o.participants} neighbours are ordering now`, text: 'Order in the next few minutes to share their delivery.', action: { label: 'Shop', run: () => nav(`/?join=${o.groupId}`) } });
    };
    const onToast = (t) => toast(t);
    s.on('opportunity', onOpp);
    s.on('toast', onToast);
    return () => { s.off('opportunity', onOpp); s.off('toast', onToast); };
  }, [user, toast, nav]);
  return null;
}

function Shell() {
  const { user } = useApp();
  const { pathname } = useLocation();
  useEffect(() => { if (pathname !== '/search') window.scrollTo(0, 0); }, [pathname]);
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  const merchant = user.role === 'merchant';
  const rider = user.role === 'rider';
  if (user.role === 'admin') return <Suspense fallback={<PageSpinner />}><Admin /></Suspense>;
  const focused = pathname.startsWith('/p/') || ['/checkout', '/cart'].includes(pathname); // no tab bar / cart bar
  const withHeader = !merchant && !rider && !pathname.startsWith('/p/') && pathname !== '/checkout';

  return (
    <div className="min-h-full">
      {withHeader && <Header />}
      <main className={focused ? 'pb-10' : 'pb-36 md:pb-10'}>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {rider ? (
              <>
                <Route path="/rider" element={<Rider />} />
                <Route path="/account" element={<Account />} />
                <Route path="*" element={<Navigate to="/rider" replace />} />
              </>
            ) : merchant ? (
              <>
                <Route path="/merchant" element={<Merchant />} />
                <Route path="/account" element={<Account />} />
                <Route path="*" element={<Navigate to="/merchant" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/c/:id" element={<Category />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/nearby" element={<Nearby />} />
                <Route path="/store/:id" element={<Store />} />
                <Route path="/p/:storeId/:itemId" element={<Product />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/group/:id" element={<Group />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/account" element={<Account />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </Suspense>
      </main>
      {rider ? <RiderNav /> : merchant ? <MerchantNav /> : (
        <>
          {!focused && <CartBar />}
          {!focused && <BottomNav />}
          <CartDrawer />
        </>
      )}
    </div>
  );
}

const Tab = ({ to, label, Icon }) => (
  <NavLink to={to} end className={({ isActive }) => `flex w-16 flex-col items-center gap-1 py-1 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-sub hover:text-ink'}`}>
    {({ isActive }) => (<><Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} />{label}</>)}
  </NavLink>
);

function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white md:hidden">
      <div className="mx-auto flex max-w-md justify-around px-2 pt-1.5">
        <Tab to="/" label="Home" Icon={House} />
        <Tab to="/categories" label="Categories" Icon={LayoutGrid} />
        <Tab to="/orders" label="Orders" Icon={ReceiptText} />
        <Tab to="/account" label="Account" Icon={UserRound} />
      </div>
    </nav>
  );
}

/** Floating "View cart" bar on phones, above the tab bar. */
function CartBar() {
  const cart = useCart();
  const nav = useNavigate();
  if (!cart.count) return null;
  const thumbs = cart.lines.slice(0, 3);
  return (
    <div className="rise-in fixed inset-x-0 bottom-[62px] z-30 px-3 md:hidden">
      <button onClick={() => nav('/cart')} className="mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-brand px-3 py-2.5 text-white shadow-[0_10px_30px_rgba(47,168,102,.45)]">
        <span className="flex -space-x-3">
          {thumbs.map(({ item }) => <span key={item.id} className="h-9 w-9 overflow-hidden rounded-full border-2 border-brand bg-white">{item.img && <img src={item.img.startsWith('http') ? item.img : item.img.startsWith('img/') ? `${serverUrl()}/${item.img}` : `./${item.img}`} alt="" className="h-full w-full object-cover" />}</span>)}
        </span>
        <span className="text-left leading-tight"><span className="block text-sm font-bold">View cart</span><span className="tnum block text-[11px] text-white/85">{cart.count} {cart.count === 1 ? 'item' : 'items'} · {inr(cart.subtotal)}</span></span>
        <ShoppingCart size={18} key={cart.bump} className={`ml-auto ${cart.bump ? 'pop' : ''}`} />
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function RiderNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <div className="flex w-full max-w-xs justify-around rounded-3xl bg-white py-2.5 shadow-[0_8px_30px_rgba(16,26,20,.14)]">
        <Tab to="/rider" label="Deliveries" Icon={Bike} />
        <Tab to="/account" label="Account" Icon={UserRound} />
      </div>
    </nav>
  );
}

function MerchantNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <div className="flex w-full max-w-xs justify-around rounded-3xl bg-white py-2.5 shadow-[0_8px_30px_rgba(16,26,20,.14)]">
        <Tab to="/merchant" label="My store" Icon={StoreIcon} />
        <Tab to="/account" label="Account" Icon={UserRound} />
      </div>
    </nav>
  );
}

function LocationSheet({ onClose }) {
  const { user, setUser, toast } = useApp();
  const [value, setValue] = useState({ location: user.location, label: user.address, short: user.area });
  const [flat, setFlat] = useState(user.flat || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.patch('/me', { location: value.location, address: value.label, flat });
      setUser(r.user);
      closeSocket();
      toast('Delivery address updated');
      onClose();
      setTimeout(() => location.reload(), 300);
    } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Delivery address</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-page" aria-label="Close"><X size={20} /></button>
        </div>
        <Suspense fallback={<div className="skeleton h-24" />}><LocationPicker value={value} onChange={setValue} /></Suspense>
        <label className="field-label mt-4">Flat / house no. <span className="font-normal text-faint">(optional)</span></label>
        <input className="input" value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="e.g. B-204, Shanti Apartments" />
        <button className="btn-primary mt-5 w-full" disabled={busy || !value.location} onClick={save}>Save address</button>
      </div>
    </div>
  );
}

function Toasts({ toasts, dismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[1000] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl ${t.kind === 'error' ? 'bg-danger text-white' : 'bg-night text-white'}`}>
          <div className="min-w-0 flex-1">
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div className={t.title ? 'text-white/75' : ''}>{t.text}</div>
          </div>
          {t.action && <button className="shrink-0 font-semibold text-[#7fdca8]" onClick={() => { t.action.run(); dismiss(t.id); }}>{t.action.label}</button>}
          <button className="shrink-0 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}
