import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// One cart for items from many shops. At checkout it becomes one order per shop, all delivered
// together by one rider. Limited to CART_MAX items in total (the server enforces this too).
export const CART_MAX = 25;
const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);
const KEY = 'ck_cart_v3';
const keyOf = (storeId, itemId) => `${storeId}|${itemId}`;

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => read(KEY, {}));
  const [favs, setFavs] = useState(() => read('ck_favs', {}));
  const [bump, setBump] = useState(0);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => write(KEY, lines), [lines]);
  useEffect(() => write('ck_favs', favs), [favs]);

  const flash = (text) => { setNotice(text); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(''), 3000); };
  const total = (ls) => Object.values(ls).reduce((n, l) => n + l.qty, 0);

  const add = useCallback((item, store, qty = 1) => {
    let ok = true;
    setLines((ls) => {
      const room = CART_MAX - total(ls);
      if (room <= 0) { ok = false; return ls; }
      const take = Math.min(qty, room);
      if (take < qty) ok = false;
      const k = keyOf(store.id, item.id);
      const prev = ls[k]?.qty || 0;
      return { ...ls, [k]: { item, store: { id: store.id, name: store.name, kind: store.kind, distanceKm: store.distanceKm }, qty: prev + take } };
    });
    setTimeout(() => (ok ? setBump((b) => b + 1) : flash(`Your cart can hold up to ${CART_MAX} items.`)), 0);
  }, []);

  const setQty = useCallback((storeId, itemId, qty) => setLines((ls) => {
    const k = keyOf(storeId, itemId);
    if (!ls[k]) return ls;
    const n = { ...ls };
    if (qty <= 0) { delete n[k]; return n; }
    const room = CART_MAX - (total(ls) - ls[k].qty);
    if (qty > room) { setTimeout(() => flash(`Your cart can hold up to ${CART_MAX} items.`), 0); qty = room; }
    n[k] = { ...ls[k], qty };
    return n;
  }), []);

  const clear = useCallback(() => setLines({}), []);

  const value = useMemo(() => {
    const list = Object.values(lines);
    const byStore = new Map();
    for (const l of list) {
      if (!byStore.has(l.store.id)) byStore.set(l.store.id, { store: l.store, lines: [], subtotal: 0, count: 0 });
      const s = byStore.get(l.store.id);
      s.lines.push(l); s.subtotal += l.qty * l.item.price; s.count += l.qty;
    }
    const count = total(lines);
    return {
      lines: list, shops: [...byStore.values()], bump, max: CART_MAX, room: CART_MAX - count,
      count,
      subtotal: list.reduce((n, l) => n + l.qty * l.item.price, 0),
      hasApprox: list.some((l) => l.item.approxPrice),
      qtyOf: (storeId, itemId) => lines[keyOf(storeId, itemId)]?.qty || 0,
      add, setQty, clear, open, setOpen,
      favs, isFav: (k) => Boolean(favs[k]),
      toggleFav: (k, data) => setFavs((f) => { const n = { ...f }; if (n[k]) delete n[k]; else n[k] = data; return n; }),
    };
  }, [lines, favs, bump, add, setQty, clear, open]);

  return (
    <CartCtx.Provider value={value}>
      {children}
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex justify-center px-3">
          <div className="rounded-2xl bg-danger px-4 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>
        </div>
      )}
    </CartCtx.Provider>
  );
}
