import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { api, inr } from '../api.js';
import { getSocket } from '../socket.js';
import { useApp } from '../App.jsx';
import { ProductImg, StatusTag, StoreIcon, storeSubtitle } from '../components/ui.jsx';

const TYPE = { combined: 'Same-store group', batched: 'Shared rider, several stores', coordinated: 'Several riders', separate: 'Single order', 'separate-fallback': 'Single order' };

export default function Merchant() {
  const { toast } = useApp();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('orders');
  const load = useCallback(() => api.get('/merchant/dashboard').then(setD).catch((e) => toast({ kind: 'error', text: e.message })), [toast]);

  useEffect(() => {
    load();
    const s = getSocket();
    const onUpd = (e) => { load(); if (e?.pickedUp) toast('Rider collected an order from your store'); };
    s?.on('merchant:update', onUpd);
    const t = setInterval(load, 15000);
    return () => { s?.off('merchant:update', onUpd); clearInterval(t); };
  }, [load, toast]);

  if (!d) return <div className="p-4"><div className="skeleton h-64" /></div>;
  const m = d.merchant;
  return (
    <div>
      <header className="pt-safe rounded-b-[32px] bg-night px-4 pb-16 pt-6 text-white md:px-6">
        <div className="flex items-center gap-4">
          <StoreIcon kind={m.kind} size={56} radius={16} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{m.name}</h1>
            <p className="truncate text-xs text-white/60">{storeSubtitle(m)}{m.address ? ` · ${m.address}` : ''}</p>
          </div>
        </div>
      </header>
      <div className="px-4 md:px-6">
        <div className="-mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Group orders" value={d.stats.groupOrders} />
          <Stat label="Orders" value={d.stats.ordersReceived} />
          <Stat label="Paid sales" value={inr(d.stats.revenue)} />
          <Stat label="Group discounts" value={inr(d.stats.discountsGiven)} />
        </div>

        <div className="mt-6 flex rounded-full bg-white p-1 shadow-card">
          {[['orders', 'Orders'], ['menu', `Products (${m.items.length})`], ['demand', 'Demand nearby']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-2 text-xs font-medium ${tab === k ? 'bg-brand text-white' : 'text-sub'}`}>{l}</button>
          ))}
        </div>

        {tab === 'orders' && (
          <div className="mt-4 space-y-3">
            {!d.groupOrders.length && <div className="card p-8 text-center text-sm text-sub">No orders yet. New orders show up here instantly.</div>}
            {d.groupOrders.map((g) => (
              <div key={g.groupId} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{g.area}</div>
                  <StatusTag status={g.status} />
                </div>
                <div className="mt-0.5 text-xs text-sub">{TYPE[g.deliveryType]} · rider {g.riderName}{g.riderPickups > 1 ? ` (${g.riderPickups} pickups)` : ''} · {new Date(g.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                <div className="mt-3 divide-y divide-line border-t border-line">
                  {g.orders.map((o) => (
                    <div key={o.ref} className="flex items-start gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1"><div className="font-medium">{o.ref}</div><div className="text-xs text-sub">{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</div></div>
                      <div className="text-right"><div className="tnum font-semibold">{inr(o.subtotal - o.discount)}</div><div className={`text-[11px] ${o.paid ? 'text-brand' : 'text-warn'}`}>{o.paid ? 'Paid' : 'Not paid yet'}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'menu' && <MenuEditor store={m} onSaved={load} />}

        {tab === 'demand' && (
          <div className="card mt-4 p-4">
            <p className="mb-3 text-sm text-sub">People ordering around your store right now. Numbers are rounded and small groups are hidden for privacy.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-sub"><th className="pb-2 font-medium">Distance</th><th className="pb-2 font-medium">All orders</th><th className="pb-2 font-medium">{storeSubtitle(m)}</th></tr></thead>
              <tbody>{d.demand.map((r) => <tr key={r.label} className="border-t border-line"><td className="py-2.5">{r.label}</td><td className="tnum">{r.all || '–'}</td><td className="tnum">{r.category || '–'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuEditor({ store, onSaved }) {
  const { toast } = useApp();
  const [rows, setRows] = useState(store.items.map((i) => ({ ...i })));
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (idx, k, v) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));
  const save = async () => {
    setBusy(true);
    try { await api.put('/merchant/menu', { items: rows }); toast('Products saved'); onSaved(); } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4">
      <p className="mb-3 text-xs text-sub">This is exactly what customers see. Tap a product to edit its details or photo.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id || i} className="card p-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setOpen(open === i ? null : i)} className="shrink-0"><ProductImg item={r} kind={store.kind} className="h-14 w-14 bg-page" /></button>
              <input className="input min-w-0 flex-1 !py-2" value={r.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="Product name" />
              <div className="relative w-24 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sub">₹</span>
                <input className="input tnum !py-2 !pl-7" inputMode="numeric" value={r.price} onChange={(e) => set(i, 'price', e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <button className="rounded-full p-2 text-faint hover:bg-page hover:text-danger" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={16} /></button>
            </div>
            {open === i && (
              <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                <input className="input !py-2" value={r.unit || ''} onChange={(e) => set(i, 'unit', e.target.value)} placeholder="Pack size (e.g. 500 g, 1 plate)" />
                <input className="input !py-2" value={r.tag || ''} onChange={(e) => set(i, 'tag', e.target.value)} placeholder="Category (e.g. Fruits, Snacks)" />
                <input className="input !py-2 sm:col-span-2" value={r.img?.startsWith('http') ? r.img : ''} onChange={(e) => set(i, 'img', e.target.value || null)} placeholder="Photo link (https://…) — leave empty to keep current photo" />
                <textarea className="input !py-2 sm:col-span-2" rows={2} value={r.desc || ''} onChange={(e) => set(i, 'desc', e.target.value)} placeholder="Short description" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-secondary" onClick={() => { setRows((x) => [...x, { id: '', name: '', price: '', tag: 'Other' }]); setOpen(rows.length); }}><Plus size={16} />Add product</button>
        <button className="btn-primary ml-auto" disabled={busy} onClick={save}><ImagePlus size={16} className="hidden" />Save products</button>
      </div>
    </div>
  );
}

const Stat = ({ label, value }) => <div className="card p-4"><div className="tnum text-lg font-semibold">{value}</div><div className="text-xs text-sub">{label}</div></div>;
