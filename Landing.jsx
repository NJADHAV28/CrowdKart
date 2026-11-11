import { useNavigate } from 'react-router-dom';
import { ArrowRight, Headphones, Play } from 'lucide-react';

const STATS = [['Up to 30%', 'less on everyday essentials'], ['2,400+', 'community members'], ['$48k+', 'saved together']];
const FEATURES = [
  ['01', 'Collect your buying power', 'From hostel essentials to team supplies, bring everyone’s needs into one simple order.'],
  ['02', 'Let AI do the comparing', 'Compare verified suppliers, landed costs and delivery dates in one clear view.'],
  ['03', 'Pay your share, securely', 'Keep contributions transparent with trusted PayPal checkout and live payment status.'],
];
const STEPS = [['Start a group', 'Choose products and invite your people.'], ['Discover your deal', 'AI finds the best value for your group.'], ['Split. Pay. Enjoy.', 'Pay your share and track every delivery.']];

export default function Landing() {
  const nav = useNavigate();
  const go = () => nav('/login');
  return (
    <div className="min-h-full bg-white font-display text-navy">
      <header className="mx-auto flex h-20 max-w-[1100px] items-center justify-between border-b border-ws-line px-5">
        <span className="text-xl font-bold">CrowdKart</span>
        <nav className="hidden gap-8 text-[11px] font-medium text-ws-mute md:flex">{['How It Works', 'Features', 'For Hostels', 'For Businesses'].map((l) => <a key={l} href="#" onClick={(e) => e.preventDefault()}>{l}</a>)}</nav>
        <div className="flex gap-3"><button className="ws-btn-outline h-10 px-5 text-xs" onClick={go}>Login</button><button className="ws-btn-primary h-10 px-5 text-xs" onClick={go}>Get Started</button></div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5">
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div>
            <span className="ws-badge bg-violet-soft text-[10px] text-violet">SMARTER SHOPPING, TOGETHER</span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.2] md:text-[56px]">Buy Together,<br />Save More.</h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-ws-mute">An intelligent way to shop in groups. Combine your needs, discover the best bulk deals with AI and pay securely with PayPal.</p>
            <div className="mt-7 flex gap-3"><button className="ws-btn-primary" onClick={go}>Get Started Free <ArrowRight size={15} /></button><button className="ws-btn-outline"><Play size={13} />Watch Demo</button></div>
            <p className="mt-5 text-[11px] text-ws-mute">No membership fees. Just collective buying power.</p>
          </div>
          <div className="rounded-3xl bg-violet-soft p-6">
            <p className="mb-4 text-[10px] font-semibold text-violet">YOUR CAMPUS. YOUR BUYING POWER.</p>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-center gap-4">
                <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6e2ee] to-[#c9c3d8]"><Headphones size={40} strokeWidth={1.3} /></span>
                <div><span className="ws-badge bg-violet-soft text-[9px] text-violet">AI MATCHED</span><h3 className="mt-2 text-lg font-semibold">Campus Audio Club</h3><p className="text-[11px] text-ws-mute">20 people. One better price.</p><p className="mt-2 text-3xl font-semibold">$42 <span className="text-[10px] font-normal text-ws-mute">/ person + $2 delivery</span></p></div>
              </div>
              <div className="mt-4 flex justify-between text-[11px]"><span>18 of 20 members joined</span><b className="text-violet">90%</b></div>
              <div className="mt-2 h-1.5 rounded bg-ws-line"><i className="block h-full w-[90%] rounded bg-violet" /></div>
            </div>
            <div className="mt-3 flex items-center justify-between"><span className="ws-badge bg-ws-green-soft text-ws-green">30% bulk discount unlocked</span><span className="rounded-lg bg-white px-3 py-2 text-xs"><b className="text-[#1a3d8f]">PayPal</b> <span className="text-[9px] text-ws-mute">Secure group payments</span></span></div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 rounded-2xl bg-ws-bg px-8 py-7 sm:grid-cols-3">{STATS.map(([v, l]) => <div key={v}><div className="text-3xl font-semibold">{v}</div><div className="text-[11px] text-ws-mute">{l}</div></div>)}</section>

        <section className="py-16">
          <h2 className="text-[28px] font-semibold">A smarter way to buy what you need.</h2>
          <p className="mb-8 mt-2 text-xs text-ws-mute">Less searching. More saving. Built for people who buy better together.</p>
          <div className="grid gap-5 md:grid-cols-3">{FEATURES.map(([n, t, b]) => <div key={n} className="rounded-2xl bg-ws-bg p-6"><span className="ws-badge bg-violet-soft text-violet">{n}</span><h3 className="mt-6 text-base font-semibold">{t}</h3><p className="mt-3 text-[11px] leading-relaxed text-ws-mute">{b}</p></div>)}</div>
        </section>

        <section className="rounded-2xl bg-navy p-8 text-white">
          <h2 className="text-2xl font-semibold">Small steps. Collective rewards.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">{STEPS.map(([t, b], i) => <div key={t} className="flex gap-3"><span className="text-3xl font-semibold text-[#b9a8f5]">{i + 1}</span><div><b className="text-sm">{t}</b><p className="mt-2 text-[11px] text-mist">{b}</p></div></div>)}</div>
        </section>

        <section className="my-12 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-violet-soft p-8">
          <div><h2 className="text-xl font-semibold">Made for your kind of community.</h2><p className="mt-2 max-w-md text-xs leading-relaxed text-ws-mute">For hostels: campus essentials, without the campus markup. For businesses: one shared order, a healthier bottom line.</p></div>
          <button className="ws-btn-primary" onClick={go}>Start saving together <ArrowRight size={15} /></button>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1100px] flex-wrap justify-between gap-6 border-t border-ws-line px-5 py-8 text-[11px] text-ws-mute">
        <div><b className="block text-lg text-navy">CrowdKart</b>Buy Together. Save More.</div>
        <div className="text-right">{['Product', 'About', 'Privacy', 'Terms', 'Contact'].join('   ·   ')}<br /><span className="mt-3 block">© 2026 CrowdKart · PayPal AI Hackathon concept</span></div>
      </footer>
    </div>
  );
}
