import { Link } from 'react-router-dom';
import { ChevronRight, Heart, LogOut, MapPin, ReceiptText, ShieldCheck } from 'lucide-react';
import { useApp } from '../App.jsx';
import { PageHeader } from '../components/ui.jsx';

const PRIVACY = [
  ['Your name and address', 'Only the store and your delivery partner see them, and only for your order.'],
  ['What you order', 'Neighbours never see your items, your store or your bill.'],
  ['In a group', 'Each group gives you a random nickname like “Teal Otter”.'],
  ['Activity near you', 'We show how many people are ordering in an area, never who, and nothing when fewer than 2 are.'],
  ['Payments', 'Neighbours only see how many orders are paid, not whose.'],
];

export default function Account() {
  const { user, logout, openLocation } = useApp();
  const merchant = user.role === 'merchant' || user.role === 'rider';
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 md:px-6">
      <PageHeader title="Account" back={null} />
      <div className="card flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-semibold text-white">{user.name?.[0]?.toUpperCase()}</div>
        <div className="min-w-0">
          <div className="text-lg font-semibold">{user.name}</div>
          <div className="text-sm text-sub">{user.role === 'rider' ? `Delivery partner · ${user.phone}` : merchant ? 'Store account' : user.area}</div>
        </div>
      </div>

      {!merchant && (
        <div className="card mt-4 divide-y divide-line">
          <MenuRow onClick={openLocation} Icon={MapPin} title="Delivery address" sub={[user.flat, user.address].filter(Boolean).join(', ')} />
          <MenuRow to="/orders" Icon={ReceiptText} title="My orders" />
          <MenuRow to="/favorites" Icon={Heart} title="Favourites" />
        </div>
      )}

      <div className="card mt-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-brand" />Your privacy</h2>
        <dl className="mt-2 divide-y divide-line">
          {PRIVACY.map(([t, d]) => <div key={t} className="py-3"><dt className="text-sm font-medium">{t}</dt><dd className="mt-0.5 text-xs text-sub">{d}</dd></div>)}
        </dl>
      </div>

      <button className="btn-secondary mt-4 w-full !text-danger" onClick={logout}><LogOut size={17} />Sign out</button>
      <p className="mt-4 text-center text-[11px] text-faint">Product photos: Wikipedia / Wikimedia Commons contributors. Map data © OpenStreetMap contributors.</p>
    </div>
  );
}

function MenuRow({ to, onClick, Icon, title, sub }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span>{sub && <span className="block truncate text-xs text-sub">{sub}</span>}</span>
      <ChevronRight size={18} className="text-faint" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 p-4 text-left hover:bg-page first:rounded-t-2xl last:rounded-b-2xl';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}
