import { useNavigate } from 'react-router-dom';
import { CartBody } from '../components/CartDrawer.jsx';
import { PageHeader } from '../components/ui.jsx';

export const readPromo = () => { try { return JSON.parse(sessionStorage.getItem('ck_promo')); } catch { return null; } };
export const savePromo = (p) => { try { p ? sessionStorage.setItem('ck_promo', JSON.stringify(p)) : sessionStorage.removeItem('ck_promo'); } catch { /* ignore */ } };

/** Full-page cart (phones, and direct links). Desktop uses the slide-in drawer. */
export default function Cart() {
  const nav = useNavigate();
  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-xl flex-col pt-4">
      <div className="px-4"><PageHeader title="My Cart" /></div>
      <div className="flex flex-1 flex-col overflow-hidden md:rounded-2xl">
        <CartBody onCheckout={() => nav('/checkout')} />
      </div>
    </div>
  );
}
