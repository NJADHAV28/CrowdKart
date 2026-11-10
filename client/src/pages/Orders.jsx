import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api.js';
import { Empty, PageHeader, ProductImg, StatusTag } from '../components/ui.jsx';

const ACTIVE = ['matching', 'awaiting_payment', 'paid', 'in_transit'];
const fmt = (t) => new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState('active');
  useEffect(() => { api.get('/orders/mine').then(setOrders).catch(() => setOrders([])); }, []);
  const list = useMemo(() => (orders || []).filter((o) => (tab === 'active' ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status))), [orders, tab]);
  const saved = (orders || []).filter((o) => o.status === 'delivered' && o.bill).reduce((s, o) => s + o.bill.saving, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 md:px-6">
      <PageHeader title="My Orders" back="/" />
      <div className="flex border-b border-line">
        {[['active', 'In Progress'], ['done', 'Completed']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px flex-1 border-b-2 pb-2.5 text-sm font-medium ${tab === k ? 'border-brand text-ink' : 'border-transparent text-sub'}`}>{l}</button>
        ))}
      </div>
      {saved > 0 && tab === 'done' && <p className="mt-3 text-center text-xs text-brand">You’ve saved {inr(saved)} by sharing deliveries</p>}
      {!orders && <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>}
      {orders && !list.length && <div className="mt-4"><Empty title={tab === 'active' ? 'No orders in progress' : 'No past orders yet'} action={<Link to="/" className="btn-primary mt-4">Browse items</Link>} /></div>}
      <div className="mt-4 space-y-3">
        {list.map((o) => {
          const first = o.items[0];
          return (
            <div key={o.id} className="card flex gap-3.5 p-3">
              <ProductImg item={first} kind={o.store.kind} className="h-24 w-24 shrink-0 bg-page" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="text-[13px] font-semibold">Order ID: {o.id.slice(4, 12).toUpperCase()}</div>
                <div className="text-xs text-sub">{o.store.name} · {fmt(o.createdAt)}</div>
                <div className="mt-0.5 truncate text-xs text-sub">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <span className="tnum text-sm font-bold">{inr(o.bill?.total ?? o.subtotal)}</span>
                  {ACTIVE.includes(o.status)
                    ? <Link to={`/group/${o.groupId}`} className="rounded-full bg-brand px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-dark">{o.status === 'awaiting_payment' ? 'Pay now' : 'Track Order'}</Link>
                    : o.status === 'cancelled' ? <StatusTag status="cancelled" /> : <Link to={`/group/${o.groupId}`} className="rounded-full border border-line px-3.5 py-1.5 text-[11px] font-semibold hover:bg-page">Details</Link>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
