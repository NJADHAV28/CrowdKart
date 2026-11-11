import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, Plus } from 'lucide-react';
import { SAVINGS, STATS } from '../../data/workspace.js';

const SCALE = 0.28; // px per dollar → $600 = 168px

export default function WsDashboard() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight lg:text-[32px]">Hey, Welcome Back!</h1>
          <p className="mt-1.5 text-base text-ws-mute">Buy together, save more with AI and PayPal.</p>
        </div>
        <Link to="/ws/create" className="ws-btn-primary h-12 w-full sm:w-56"><Plus size={16} />Create Group Buy</Link>
      </div>

      <section className="my-8 grid grid-cols-2 gap-4 lg:my-12 lg:grid-cols-4 lg:gap-6">
        {STATS.map((s) => (
          <div key={s.label} className="flex min-h-[132px] flex-col rounded-2xl bg-white px-5 py-4">
            <span className="text-[13px] font-medium text-ws-mute">{s.label}</span>
            <span className="mt-3 text-[28px] font-semibold leading-tight lg:text-[30px]">{s.value}</span>
            <span className={`mt-auto text-[11px] font-medium ${s.up ? 'text-ws-green' : 'text-ws-mute'}`}>{s.note}</span>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[696fr_408fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="ws-card">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Your active group buy</h2><span className="ws-badge bg-ws-green-soft text-ws-green">OPEN</span></div>
            <div className="mt-6 flex gap-6">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e6e2ee] to-[#c9c3d8] text-navy"><Headphones size={44} strokeWidth={1.4} /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[22px] font-semibold">Campus Audio Club</h3>
                <p className="mt-2 text-[13px] text-ws-mute">Wireless headphones · Electronics</p>
                <div className="mt-6 flex justify-between text-[13px] font-medium"><span>18 / 20 members</span><span className="text-ws-mute">Closes Nov 14</span></div>
              </div>
            </div>
            <div className="mt-6 h-[7px] overflow-hidden rounded bg-ws-line"><i className="block h-full w-[90%] rounded bg-violet" /></div>
            <div className="mt-5 flex justify-end"><Link to="/ws/deals" className="ws-btn-outline w-full sm:w-52">View group <ArrowRight size={15} /></Link></div>
          </div>

          <div className="ws-card">
            <div className="flex items-start justify-between">
              <div><h2 className="text-xl font-semibold">Savings overview</h2><p className="mt-1.5 text-[13px] text-ws-mute">Your collective advantage, growing monthly.</p></div>
              <span className="text-xs font-medium text-ws-mute">Last 6 months ⌄</span>
            </div>
            <div className="relative mb-3 ml-11 mt-7 h-[168px]">
              {[200, 400, 600].map((v) => (
                <div key={v} className="absolute inset-x-0 h-px bg-ws-line" style={{ bottom: v * SCALE }}><span className="absolute -left-11 -top-2 text-[10px] text-ws-mute">${v}</span></div>
              ))}
              <div className="absolute inset-0 flex items-end justify-around">
                {SAVINGS.map((s, i) => <div key={s.m} title={`${s.m}: $${s.v}`} className={`w-8 rounded-md sm:w-10 ${i === SAVINGS.length - 1 ? 'bg-violet' : 'bg-[#d9cff5]'}`} style={{ height: s.v * SCALE }} />)}
              </div>
            </div>
            <div className="ml-11 flex justify-around text-[11px] text-ws-mute">{SAVINGS.map((s) => <span key={s.m} className="w-8 text-center sm:w-10">{s.m}</span>)}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="ws-card bg-violet-soft">
            <span className="ws-badge bg-white text-violet">✦ YOUR AI PICK</span>
            <h2 className="mt-4 text-[25px] font-semibold leading-snug">Same headphones.<br />A better group price.</h2>
            <p className="mb-6 mt-3 text-sm leading-relaxed text-ws-mute">Save 30% with SoundSource.<br />Fast delivery. 4.9 seller rating.</p>
            <Link to="/ws/deals" className="ws-btn-primary w-full">Explore the deal <ArrowRight size={15} /></Link>
          </div>
          <div className="ws-card">
            <h3 className="text-lg font-semibold">A little AI. A lot more savings.</h3>
            <p className="mb-4 mt-2 text-[13px] text-ws-mute">Find deals, plan orders, ask anything.</p>
            <Link to="/ws/assistant" className="ws-btn-outline w-full">Ask CrowdKart <ArrowRight size={15} /></Link>
          </div>
          <div className="ws-card">
            <h3 className="text-lg font-semibold">Recent orders</h3>
            <div className="mt-4 flex items-center justify-between text-sm font-medium"><span>Notebook Collective</span><span className="ws-badge bg-ws-green-soft text-ws-green">Delivered</span></div>
            <p className="mt-4 text-xs text-ws-mute">24 notebooks · Nov 06 · $8.00</p>
          </div>
        </div>
      </section>
    </>
  );
}
