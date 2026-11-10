import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, ChevronRight, Clock, ShoppingBag, Trash2, X } from 'lucide-react';
import { inr } from '../api.js';
import { useCart } from '../state/cart.jsx';
import { ProductImg, QtyPill, StoreIcon } from './ui.jsx';

/** Cart contents, used both in the slide-in drawer and as the full /cart page on phones. */
export function CartBody({ onCheckout, onClose }) {
  const cart = useCart();
  if (!cart.count) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-soft text-brand"><ShoppingBag size={40} strokeWidth={1.6} /></div>
        <div className="mt-5 text-lg font-bold">You don’t have any items in your cart</div>
        <p className="mt-1 text-sm text-sub">Your favourite items are just a click away</p>
        <Link to="/" onClick={onClose} className="btn-primary mt-6">Start Shopping</Link>
      </div>
    );
  }
  const fastest = Math.min(...cart.shops.map((s) => s.store.etaMin || 99));
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-page p-3">
        <div className="rounded-2xl bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Clock size={20} /></span>
            <div>
              <div className="font-bold">{fastest < 99 ? `Delivery in ${fastest + 2}–${fastest + 10} minutes` : 'Fast delivery'}</div>
              <div className="text-xs text-sub">{cart.count} of {cart.max} items · {cart.shops.length} {cart.shops.length === 1 ? 'shop' : 'shops'}</div>
            </div>
          </div>
          {cart.shops.length > 1 && <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-dark"><Bike size={14} />One rider collects from all {cart.shops.length} shops in one trip.</div>}
        </div>

        {cart.shops.map(({ store, lines, subtotal }) => (
          <div key={store.id} className="overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
              <StoreIcon kind={store.kind} size={28} radius={8} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{store.name}</span>
              <span className="tnum text-xs text-sub">{inr(subtotal)}</span>
            </div>
            {lines.map(({ item, qty }) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <ProductImg item={item} kind={store.kind} className="h-14 w-14 shrink-0 border border-line bg-white" rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">{item.name}</div>
                  <div className="text-[11px] text-sub">{item.unit || item.tag}</div>
                  <div className="tnum mt-0.5 text-[13px] font-bold">{item.approxPrice ? '≈' : ''}{inr(item.price)}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <QtyPill size="sm" value={qty} onChange={(v) => cart.setQty(store.id, item.id, v)} />
                  <button onClick={() => cart.setQty(store.id, item.id, 0)} className="text-faint hover:text-danger" aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="rounded-2xl bg-white p-4 text-sm">
          <div className="mb-3 font-bold">Bill details</div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sub">Items total</span><span className="tnum">{cart.hasApprox ? '≈' : ''}{inr(cart.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-sub">Delivery charge</span><span className="text-brand">Shared with neighbours</span></div>
            <div className="flex justify-between border-t border-dashed border-line pt-2 font-bold"><span>Grand total</span><span className="tnum">{cart.hasApprox ? '≈' : ''}{inr(cart.subtotal)} +</span></div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">When neighbours order around the same time, you share one rider and the delivery fee drops. Add a tip and delivery instructions on the next step.</p>
        </div>
      </div>
      <div className="pb-safe border-t border-line bg-white p-3">
        <button onClick={onCheckout} className="flex w-full items-center justify-between rounded-xl bg-brand px-4 py-3 text-white transition hover:bg-brand-dark">
          <span className="text-left leading-tight"><span className="tnum block font-bold">{inr(cart.subtotal)}</span><span className="block text-[11px] text-white/80">TOTAL</span></span>
          <span className="flex items-center gap-1 font-bold">Proceed <ChevronRight size={18} /></span>
        </button>
      </div>
    </>
  );
}

/** Slide-in cart from the right (desktop and tablets). */
export default function CartDrawer() {
  const cart = useCart();
  const nav = useNavigate();
  useEffect(() => {
    if (!cart.open) return undefined;
    const onKey = (e) => e.key === 'Escape' && cart.setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [cart.open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cart.open) return null;
  const close = () => cart.setOpen(false);
  return (
    <div className="fade-in fixed inset-0 z-[950] flex justify-end bg-black/50" onClick={close}>
      <aside className="drawer-in flex h-full w-full max-w-[420px] flex-col bg-page shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Your cart">
        <div className="flex items-center justify-between bg-white px-4 py-4">
          <h2 className="text-lg font-bold">My Cart</h2>
          <button onClick={close} className="rounded-full p-1.5 hover:bg-page" aria-label="Close cart"><X size={20} /></button>
        </div>
        <CartBody onClose={close} onCheckout={() => { close(); nav('/checkout'); }} />
      </aside>
    </div>
  );
}
