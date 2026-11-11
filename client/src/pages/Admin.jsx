import { useCallback, useEffect, useState } from 'react';
import { BadgeIndianRupee, Bike, CheckCircle2, Clock, LogOut, Package, Save, ShieldCheck, XCircle } from 'lucide-react';
import { api, inr } from '../api.js';
import { getSocket } from '../socket.js';
import { useApp } from '../App.jsx';
import { Logo, StatusTag } from '../components/ui.jsx';

const fmt = (t) => (t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '–');

/** Admin panel: overview, UPI payment verification and settings (UPI ID, wait time). */
export default function Admin() {
  const { logout, toast } = useApp();
  const [tab, setTab] = useState('payments');
  const [ov, setOv] = useState(null);
  const [pays, setPays] = useState(null);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/overview').then(setOv).catch((e) => toast({ kind: 'error', text: e.message }));
    api.get('/admin/payments').then(setPays).catch(() => {});
  }, [toast]);
  useEffect(() => {
    load();
    api.get('/admin/settings').then(setSettings).catch(() => {});
    const s = getSocket();
    s?.on('admin:update', load);
    const t = setInterval(load, 10000);
    return () => { s?.off('admin:update', load); clearInterval(t); };
  }, [load]);

  const act = async (id, what) => {
    setBusy(true);
    try {
      const note = what === 'reject' ? window.prompt('Reason (shown to the customer)', 'Payment not received') : null;
      if (what === 'reject' && note === null) return;
      setPays(await api.post(`/admin/payments/${id}/${what}`, { note }));
      toast(what === 'confirm' ? 'Payment confirmed. The order is on its way.' : 'Payment rejected');
      load();
    } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try { setSettings(await api.put('/admin/settings', settings)); toast('Settings saved'); } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  const c = ov?.counts;
  const toVerify = (pays || []).filter((p) => p.status === 'submitted');
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <Logo />
          <span className="rounded-full bg-night px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Admin</span>
          <button onClick={logout} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-sub hover:bg-page hover:text-ink"><LogOut size={16} />Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 md:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat Icon={Package} label="Orders today" value={c?.ordersToday} sub={`${c?.orders ?? '–'} total`} />
          <Stat Icon={BadgeIndianRupee} label="Payments received" value={c ? inr(c.revenue) : '–'} />
          <Stat Icon={Clock} label="UPI to verify" value={c?.upiToVerify} highlight={c?.upiToVerify > 0} />
          <Stat Icon={Bike} label="Riders online" value={c ? `${c.ridersOnline}/${c.riders}` : '–'} sub={c ? `${c.customers} customers · ${c.merchants} shops` : ''} />
        </div>

        <div className="mt-6 flex gap-1 rounded-full bg-white p-1 shadow-card sm:w-fit">
          {[['payments', `UPI payments${toVerify.length ? ` (${toVerify.length})` : ''}`], ['orders', 'Recent orders'], ['settings', 'Settings']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold sm:flex-none ${tab === k ? 'bg-brand text-white' : 'text-sub'}`}>{l}</button>
          ))}
        </div>

        {tab === 'payments' && (
          <div className="card mt-4 overflow-hidden">
            {!settings?.upiId && <p className="border-b border-line bg-sun-soft p-3 text-sm">Add your UPI ID in <button className="font-semibold underline" onClick={() => setTab('settings')}>Settings</button> to turn on “Pay with UPI app”.</p>}
            {!pays?.length && <p className="p-8 text-center text-sm text-sub">No UPI payments yet.</p>}
            <div className="divide-y divide-line">
              {(pays || []).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-base font-bold">{inr(p.amountInr)}</span>
                      <PayStatus s={p.status} />
                    </div>
                    <div className="mt-0.5 text-xs text-sub">{p.customer} · order {p.groupRef} · {fmt(p.submittedAt || p.createdAt)}</div>
                    <div className="mt-1 text-xs">UTR: <b className="tnum">{p.utr || 'not submitted yet'}</b>{p.note ? <span className="text-danger"> · {p.note}</span> : null}</div>
                  </div>
                  {p.status === 'submitted' && (
                    <div className="flex gap-2">
                      <button disabled={busy} onClick={() => act(p.id, 'reject')} className="btn-secondary !px-3 !py-2 text-xs !text-danger"><XCircle size={15} />Reject</button>
                      <button disabled={busy} onClick={() => act(p.id, 'confirm')} className="btn-primary !px-4 !py-2 text-xs"><CheckCircle2 size={15} />Received</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="border-t border-line p-3 text-[11px] text-faint">Check each UTR against your bank or UPI app before marking it received. Confirming dispatches the delivery.</p>
          </div>
        )}

        {tab === 'orders' && (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-sub">{['Order', 'Customer', 'Shop', 'Items', 'Amount', 'Status', 'Placed'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {(ov?.recent || []).map((o) => (
                  <tr key={o.ref + o.createdAt} className="border-t border-line">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.ref}</td>
                    <td className="px-4 py-2.5">{o.customer}</td>
                    <td className="max-w-48 truncate px-4 py-2.5">{o.shop}</td>
                    <td className="px-4 py-2.5 tnum">{o.items}</td>
                    <td className="px-4 py-2.5 tnum">{inr(o.subtotal + o.tip)}</td>
                    <td className="px-4 py-2.5"><StatusTag status={o.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-sub">{fmt(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ov?.recent?.length && <p className="p-8 text-center text-sm text-sub">No orders yet.</p>}
          </div>
        )}

        {tab === 'settings' && settings && (
          <div className="card mt-4 max-w-xl p-5">
            <h2 className="font-bold">UPI payments</h2>
            <p className="mt-0.5 text-xs text-sub">Customers see “Pay with UPI app”, which opens Google Pay, PhonePe, Paytm or BHIM with this UPI ID and the exact amount.</p>
            <label className="field-label mt-4">Your UPI ID</label>
            <input className="input" value={settings.upiId} onChange={(e) => setSettings({ ...settings, upiId: e.target.value.trim() })} placeholder="yourname@okaxis" />
            <label className="field-label mt-4">Name shown in the UPI app</label>
            <input className="input" value={settings.payeeName} onChange={(e) => setSettings({ ...settings, payeeName: e.target.value })} placeholder="CrowdKart" />
            <p className="mt-2 text-[11px] text-faint">Tip: a business/merchant UPI ID works most reliably. Some apps limit pre-filled payments to personal UPI IDs.</p>

            <h2 className="mt-6 font-bold">Checkout</h2>
            <label className="field-label mt-3">Wait for neighbours before payment</label>
            <select className="input" value={settings.waitMinutes} onChange={(e) => setSettings({ ...settings, waitMinutes: Number(e.target.value) })}>
              <option value={0}>Don’t wait: customers pay right after placing the order</option>
              {[5, 10, 15].map((m) => <option key={m} value={m}>Wait {m} minutes so neighbours can join</option>)}
            </select>
            <button className="btn-primary mt-6" disabled={busy} onClick={save}><Save size={16} />Save settings</button>
            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-faint"><ShieldCheck size={12} />Admin password is set in server/.env (ADMIN_PASSWORD), not here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const Stat = ({ Icon, label, value, sub, highlight }) => (
  <div className={`card p-4 ${highlight ? 'ring-2 ring-sun' : ''}`}>
    <Icon size={18} className="text-brand" />
    <div className="tnum mt-1 text-xl font-bold">{value ?? '–'}</div>
    <div className="text-xs text-sub">{label}</div>
    {sub && <div className="text-[11px] text-faint">{sub}</div>}
  </div>
);

function PayStatus({ s }) {
  const m = { submitted: ['To verify', 'bg-sun-soft text-[#8a6300]'], captured: ['Received', 'bg-brand-soft text-brand-dark'], rejected: ['Rejected', 'bg-danger/10 text-danger'], created: ['Not paid yet', 'bg-page text-sub'] }[s] || [s, 'bg-page text-sub'];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${m[1]}`}>{m[0]}</span>;
}

