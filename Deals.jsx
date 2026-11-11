import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../App.jsx';
import { DEALS, usd } from '../../data/workspace.js';

const MEMBERS = 20;
const Row = ({ k, v }) => <div className="flex justify-between text-[11px]"><span className="text-ws-mute">{k}</span><span className="font-medium">{v}</span></div>;

export default function Deals() {
  const { toast } = useApp();
  const [picked, setPicked] = useState('ss');
  const cost = (d) => d.price * MEMBERS + d.shipping;
  const mine = (d) => cost(d) / MEMBERS;
  const sel = DEALS.find((d) => d.id === picked);

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight lg:text-[32px]">One group. Three great options.</h1>
      <p className="mt-1.5 text-base text-ws-mute">AI compared landed costs, seller quality and delivery for your group.</p>
      <div className="my-5 flex flex-wrap items-center justify-between gap-2"><span className="ws-badge bg-violet-soft text-violet">✦ AI-POWERED COMPARISON</span><span className="text-xs text-ws-mute">Campus Audio Club · 20 wireless headphones</span></div>

      <div className="grid gap-5 md:grid-cols-3">
        {DEALS.map((d) => (
          <button key={d.id} onClick={() => setPicked(d.id)} aria-pressed={picked === d.id} className={`rounded-2xl bg-white p-5 text-left transition ${picked === d.id ? 'ring-2 ring-violet' : 'ring-1 ring-ws-line hover:ring-violet/40'}`}>
            <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-violet">{d.brand.toUpperCase()}{d.best && <span className="ws-badge bg-violet-soft">✦ BEST DEAL</span>}</div>
            <h3 className="mt-4 text-lg font-semibold">{d.brand}</h3>
            <div className="mt-2 text-[32px] font-semibold leading-none">{usd(d.price)}</div>
            <p className="mb-5 mt-1 text-[10px] text-ws-mute">per unit · retail $60.00</p>
            <div className="space-y-2.5 border-t border-ws-line pt-4">
              <Row k="Bulk discount" v={d.discount} /><Row k="Shared shipping" v={d.shipping ? usd(d.shipping) : 'Free'} /><Row k="Estimated delivery" v={d.delivery} /><Row k="Seller rating" v={`★ ${d.rating} / 5`} />
            </div>
            <div className="mt-4 space-y-2 border-t border-ws-line pt-4"><Row k="Total group cost" v={usd(cost(d))} /><div className="flex items-center justify-between text-[11px]"><span className="text-ws-mute">Your contribution</span><b className={`text-xl ${d.best ? 'text-violet' : ''}`}>{usd(mine(d))}</b></div></div>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-violet-soft p-6 md:col-span-2">
          <span className="ws-badge bg-white text-violet">✦ WHY THIS DEAL?</span>
          <h2 className="mt-4 text-xl font-semibold">The lowest total. The strongest confidence.</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ws-mute">SoundSource saves your group $20 vs. the next best offer, arrives 2 days sooner and has the highest seller rating. Shared shipping is only $2 per person.</p>
        </div>
        <div className="ws-card">
          <h3 className="text-base font-semibold">{sel.brand} selected</h3>
          <p className="mb-5 mt-2 text-xs text-ws-mute">{usd(mine(sel))} / person, including delivery</p>
          <button className="ws-btn-primary w-full" onClick={() => toast(`${sel.brand} selected for your group`)}>Select Supplier <ArrowRight size={15} /></button>
          <p className="mt-3 text-center text-[11px] text-ws-mute">No charge until you confirm checkout.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button className="ws-btn-outline" onClick={() => toast('Side-by-side comparison coming soon')}>Compare Deals</button>
        <button className="ws-btn-primary" onClick={() => toast('Payment step is next in the flow')}>Proceed to Payment <ArrowRight size={15} /></button>
      </div>
    </>
  );
}
