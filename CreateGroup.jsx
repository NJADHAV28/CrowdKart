import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Search } from 'lucide-react';
import { useApp } from '../../App.jsx';
import { useWs } from '../../components/workspace/WorkspaceLayout.jsx';
import { DEFAULT_GROUP, PRODUCTS, usd } from '../../data/workspace.js';

const STEPS = ['Group Details', 'Add Products', 'Invite Members', 'Review & Create'];
const CATS = ['All products', 'Electronics', 'Stationery', 'Daily essentials'];
const niceDate = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function StepBar({ step }) {
  return (
    <ol className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {STEPS.map((label, i) => {
        const n = i + 1, done = n < step, now = n === step;
        return (
          <li key={label} className={`flex h-11 items-center gap-2.5 rounded-lg px-3 text-xs font-medium ${now ? 'bg-violet-soft text-violet' : 'bg-white text-ws-mute'}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${done || now ? 'bg-violet text-white' : 'border border-ws-line'}`}>{done ? <Check size={13} /> : n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

const Footer = ({ left, right }) => <div className="mt-6 flex items-center justify-between gap-3">{left}{right}</div>;

export default function CreateGroup() {
  const nav = useNavigate();
  const { toast } = useApp();
  const { openModal } = useWs();
  const [step, setStep] = useState(1);
  const [g, setG] = useState(DEFAULT_GROUP);
  const set = (k) => (e) => setG((x) => ({ ...x, [k]: e.target.value }));
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(CATS[0]);
  const [emails, setEmails] = useState('');

  const chosen = PRODUCTS.filter((p) => g.selected.includes(p.id));
  const retail = chosen.reduce((s, p) => s + p.price, 0) * g.qty;
  const unit = chosen.reduce((s, p) => s + p.price * (1 - p.pct / 100), 0);
  const groupPrice = unit * g.qty;
  const savings = retail - groupPrice;
  const perPerson = g.target ? savings / g.target : 0;

  const toggle = (id) => {
    const on = g.selected.includes(id);
    setG((x) => ({ ...x, selected: on ? x.selected.filter((i) => i !== id) : [...x.selected, id] }));
    if (!on) openModal('added');
  };
  const sendInvites = () => {
    const list = emails.split(',').map((e) => e.trim()).filter(Boolean);
    if (!list.length) return;
    setG((x) => ({ ...x, invites: [...x.invites, ...list.map((e) => ({ name: e, note: 'Invite pending' }))] }));
    setEmails(''); toast('Invites sent');
  };
  const copyLink = () => { try { navigator.clipboard?.writeText('crowdkart.app/join/campus-audio'); } catch { /* ignore */ } openModal('link'); };

  const Aside = ({ children }) => <aside className="rounded-2xl bg-violet-soft p-6">{children}</aside>;

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight lg:text-[32px]">{['Create a Group Buy', 'Find what your group needs', 'Good deals are better shared', 'Ready to buy better, together?'][step - 1]}</h1>
      <p className="mb-8 mt-1.5 text-base text-ws-mute">{['Turn everyday needs into collective savings.', 'Every item adds to your collective buying power.', 'Invite your community to the Campus Audio Club.', 'Review your group before discovering the best supplier.'][step - 1]}</p>
      <StepBar step={step} />

      {step === 1 && (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="ws-card">
              <h2 className="text-lg font-semibold">Let’s bring your group together</h2>
              <p className="mb-5 mt-1 text-xs text-ws-mute">A few details help AI find the right deals for you.</p>
              <label className="ws-label">Group Name</label>
              <input className="ws-input" value={g.name} onChange={set('name')} />
              <label className="ws-label mt-5">Description</label>
              <textarea className="ws-input h-24 resize-none py-3" value={g.description} onChange={set('description')} />
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div><label className="ws-label">Category</label><select className="ws-input" value={g.category} onChange={set('category')}>{CATS.slice(1).map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><label className="ws-label">Target Participants</label><select className="ws-input" value={g.target} onChange={(e) => setG({ ...g, target: +e.target.value })}>{[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n} members</option>)}</select></div>
                <div><label className="ws-label">Budget per person (USD)</label><input className="ws-input" type="number" min="1" value={g.budget} onChange={(e) => setG({ ...g, budget: +e.target.value })} /></div>
                <div><label className="ws-label">Order Deadline</label><input className="ws-input" type="date" value={g.deadline} onChange={set('deadline')} /></div>
              </div>
            </div>
            <Aside>
              <span className="text-[10px] font-semibold text-violet">✦ SMART GROUPS</span>
              <h2 className="mt-3 text-2xl font-semibold leading-snug">A shared goal.<br />A stronger deal.</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-ws-mute">Groups of 20 or more can unlock better pricing from verified suppliers.</p>
              <h3 className="mt-10 text-[13px] font-semibold">Your plan at a glance</h3>
              <p className="mt-2 text-xs leading-6 text-ws-mute">{g.target} participants<br />{usd(g.budget * g.target)} total group budget<br />{g.category} category</p>
              <p className="mb-2 mt-6 text-xs font-semibold">Expected Delivery Date</p>
              <div className="rounded-[10px] bg-white px-4 py-3 text-xs text-ws-mute">Nov 18–20, 2026</div>
            </Aside>
          </div>
          <Footer left={<Link to="/ws" className="ws-btn-outline">Cancel</Link>} right={<button className="ws-btn-primary" disabled={g.name.trim().length < 2} onClick={() => setStep(2)}>Next: Add Products <ArrowRight size={15} /></button>} />
        </>
      )}

      {step === 2 && (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="relative"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ws-mute" /><input className="ws-input !pl-11" placeholder="Search headphones, chargers, notebooks…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <div className="my-4 flex flex-wrap gap-2">{CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={`h-8 rounded-md px-4 text-[11px] font-medium ${cat === c ? 'bg-violet-soft text-violet' : 'bg-white text-ws-mute'}`}>{c}</button>)}</div>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {PRODUCTS.filter((p) => (cat === CATS[0] || p.cat === cat) && p.name.toLowerCase().includes(query.toLowerCase())).map((p) => {
                  const on = g.selected.includes(p.id);
                  return (
                    <div key={p.id} className="rounded-2xl bg-white p-3">
                      <div className="flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-[#ece8f7] to-[#d8d0ee] text-navy"><p.Icon size={40} strokeWidth={1.3} /></div>
                      <b className="mt-3 block text-xs font-semibold">{p.name}</b>
                      <div className="mt-1 flex items-center gap-2 text-[11px]"><b>{usd(p.price)}</b><span className="text-ws-green">{p.pct}% bulk saving</span></div>
                      <button onClick={() => toggle(p.id)} className={`${on ? 'ws-btn-primary' : 'ws-btn-outline'} mt-3 h-9 w-full text-xs`}>{on ? <><Check size={13} />Added</> : <>Add to group <Plus size={13} /></>}</button>
                    </div>
                  );
                })}
                <div className="rounded-2xl bg-violet-soft p-5"><h3 className="text-lg font-semibold leading-snug">One shared order.<br />More possibilities.</h3><p className="mt-2 text-[11px] leading-relaxed text-ws-mute">Mix essentials across categories, then let AI compare suppliers.</p></div>
              </div>
            </div>
            <aside className="h-fit rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Selected products</h2><span className="ws-badge bg-violet-soft text-violet">{chosen.length} PRODUCT{chosen.length === 1 ? '' : 'S'}</span></div>
              <ul className="mt-4 space-y-3">{chosen.map((p) => <li key={p.id} className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><p.Icon size={20} /></span><span><b className="block text-xs font-semibold">{p.name}</b><span className="text-[11px] text-ws-mute">{usd(p.price)} retail</span></span></li>)}</ul>
              <p className="mb-2 mt-5 text-[10px] font-semibold text-ws-mute">GROUP QUANTITY</p>
              <div className="flex h-11 items-center justify-between rounded-lg border border-ws-line px-3">
                <button aria-label="Decrease" onClick={() => setG({ ...g, qty: Math.max(1, g.qty - 1) })}><Minus size={15} /></button><b className="text-sm">{g.qty}</b><button aria-label="Increase" onClick={() => setG({ ...g, qty: g.qty + 1 })}><Plus size={15} /></button>
              </div>
              <dl className="mt-5 space-y-3 border-t border-ws-line pt-4 text-xs text-ws-mute">
                <div className="flex justify-between"><dt>Total quantity</dt><dd className="font-semibold text-navy">{g.qty} units</dd></div>
                <div className="flex justify-between"><dt>Estimated unit price</dt><dd className="font-semibold text-navy">{usd(unit)}</dd></div>
                <div className="flex justify-between"><dt>Estimated group price</dt><dd className="font-semibold text-navy">{usd(groupPrice)}</dd></div>
                <div className="flex justify-between"><dt>Estimated product savings</dt><dd className="font-semibold text-ws-green">{usd(savings)}</dd></div>
              </dl>
              <p className="mt-4 text-[11px] text-ws-mute">Shipping confirmed when you select a supplier.</p>
            </aside>
          </div>
          <Footer left={<button className="ws-btn-outline" onClick={() => setStep(1)}><ArrowLeft size={15} />Back</button>} right={<button className="ws-btn-primary" disabled={!chosen.length} onClick={() => setStep(3)}>Next: Invite Members <ArrowRight size={15} /></button>} />
        </>
      )}

      {step === 3 && (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="ws-card">
              <h2 className="text-lg font-semibold">Bring your people along</h2>
              <p className="mb-5 mt-1 text-xs text-ws-mute">Your group is saved as a draft until you review and create it.</p>
              <label className="ws-label">Invite by email</label>
              <div className="flex gap-3"><input className="ws-input" placeholder="jamie@campus.edu, taylor@campus.edu" value={emails} onChange={(e) => setEmails(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendInvites()} /><button className="ws-btn-primary h-12 shrink-0" onClick={sendInvites}>Send invite</button></div>
              <label className="ws-label mt-6">Or share an invitation link</label>
              <p className="-mt-1 mb-2 text-[11px] text-ws-mute">Anyone with this link can request to join</p>
              <div className="flex gap-3"><input readOnly className="ws-input" value="crowdkart.app/join/campus-audio" /><button className="ws-btn-outline h-12 shrink-0" onClick={copyLink}>Copy link</button></div>
              <h3 className="mb-4 mt-8 text-sm font-semibold">Ready to invite</h3>
              <ul className="grid gap-4 sm:grid-cols-3">{g.invites.map((p) => <li key={p.name} className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft text-xs font-semibold text-violet">{p.name[0].toUpperCase()}</span><span className="min-w-0"><b className="block truncate text-xs font-semibold">{p.name}</b><span className="text-[10px] text-ws-mute">{p.note}</span></span></li>)}</ul>
            </div>
            <Aside>
              <h2 className="text-2xl font-semibold leading-snug">{g.target} people.<br />One great deal.</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-ws-mute">Share with your hostel, class or campus community.</p>
              <div className="mt-10 text-[34px] font-semibold text-violet">{usd(perPerson).replace('.00', '')}</div>
              <p className="mt-1 text-xs text-ws-mute">estimated product savings per person</p>
              <p className="mt-8 text-[11px] leading-relaxed text-ws-mute">Final price includes shared delivery costs and is confirmed before payment.</p>
            </Aside>
          </div>
          <Footer left={<button className="ws-btn-outline" onClick={() => setStep(2)}><ArrowLeft size={15} />Back</button>} right={<button className="ws-btn-primary" onClick={() => setStep(4)}>Next: Review Group <ArrowRight size={15} /></button>} />
        </>
      )}

      {step === 4 && (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="ws-card">
              <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{g.name}</h2><span className="ws-badge bg-violet-soft text-violet">DRAFT</span></div>
              <p className="mb-8 mt-2 text-[13px] text-ws-mute">{g.description}</p>
              <dl className="space-y-5 text-[13px]">
                {[['Category', g.category], ['Participants', `${g.target} members`], ['Budget', `${usd(g.budget)} per person`], ['Order deadline', niceDate(g.deadline)], ['Expected delivery', 'Nov 18–20, 2026']].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-ws-mute">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
              <ul className="mt-8 space-y-3 border-t border-ws-line pt-6">{chosen.map((p) => <li key={p.id} className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-soft text-violet"><p.Icon size={22} /></span><span><b className="block text-[13px] font-semibold">{p.name}</b><span className="text-[11px] text-ws-mute">{g.qty} units · Target product total {usd(retail)}</span></span></li>)}</ul>
            </div>
            <Aside>
              <h2 className="text-lg font-semibold">What happens next?</h2>
              <ol className="mt-5 space-y-4 text-xs">{['AI compares verified suppliers', 'Your group confirms a deal', 'Everyone pays their own share', 'One delivery. More savings.'].map((t, i) => <li key={t}><span className="mr-2 text-ws-mute">{i + 1}</span>{t}</li>)}</ol>
              <p className="mt-16 text-[11px] text-ws-mute">No payment is taken when you create a group.</p>
            </Aside>
          </div>
          <Footer left={<button className="ws-btn-outline" onClick={() => setStep(3)}><ArrowLeft size={15} />Back</button>} right={<button className="ws-btn-primary" onClick={() => nav('/ws/deals')}>Create &amp; Find Deals <ArrowRight size={15} /></button>} />
        </>
      )}
    </>
  );
}
