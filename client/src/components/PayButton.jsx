import { useEffect, useRef, useState } from 'react';
import { AppWindow, CreditCard, Loader2, Smartphone, Wallet } from 'lucide-react';
import UpiAppPay from './UpiAppPay.jsx';
import { api, inr } from '../api.js';
import { useApp } from '../App.jsx';

const loadScript = (src, test) => new Promise((resolve, reject) => {
  if (test()) return resolve(test());
  const s = document.createElement('script');
  s.src = src;
  s.onload = () => resolve(test());
  s.onerror = () => reject(new Error('Couldn’t load the payment page. Check your connection.'));
  document.head.appendChild(s);
});

const UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM'];

export default function PayButton({ groupId, amountInr, onPaid, upiPayment }) {
  const scope = 'mine';
  const { config, user, toast } = useApp();
  const pay = config?.payments || {};
  const methods = [
    ...(pay.upi ? [{ id: 'upiapp', label: 'Pay with UPI app', desc: 'Opens Google Pay, PhonePe, Paytm or BHIM on your phone', Icon: AppWindow }] : []),
    ...(pay.razorpay || !pay.upi ? [
      { id: 'upi', label: pay.upi ? 'UPI via Razorpay' : 'UPI', desc: UPI_APPS.join(', ') + ' or any UPI app', Icon: Smartphone, provider: 'razorpay' },
      { id: 'card', label: 'Card, netbanking or wallet', desc: 'Debit/credit card, all major banks, Paytm & other wallets', Icon: CreditCard, provider: 'razorpay' },
    ] : []),
    ...(pay.paypal ? [{ id: 'paypal', label: 'PayPal', desc: 'For international cards and PayPal balance', Icon: Wallet, provider: 'paypal' }] : []),
  ];
  const [method, setMethod] = useState(pay.upi ? 'upiapp' : 'upi');
  const [busy, setBusy] = useState(false);
  const ppRef = useRef(null);

  // PayPal renders its own button
  useEffect(() => {
    if (method !== 'paypal' || !pay.paypal || !ppRef.current) return undefined;
    let buttons;
    let paymentId = null;
    loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(pay.paypal.clientId)}&currency=${pay.paypal.currency}&intent=capture`, () => window.paypal)
      .then((paypal) => {
        if (!ppRef.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 46 },
          createOrder: async () => { const p = await api.post('/payments', { groupId, scope, method: 'paypal' }); paymentId = p.id; return p.paypalOrderId; },
          onApprove: async () => { await api.post(`/payments/${paymentId}/capture`); toast('Payment received'); onPaid?.(); },
          onError: () => toast({ kind: 'error', text: 'Payment didn’t go through. Please try again.' }),
        });
        ppRef.current.innerHTML = '';
        buttons.render(ppRef.current);
      }).catch((e) => toast({ kind: 'error', text: e.message }));
    return () => { try { buttons?.close(); } catch { /* ignore */ } };
  }, [method, pay.paypal, groupId, scope, toast, onPaid]);

  const start = async () => {
    setBusy(true);
    try {
      const p = await api.post('/payments', { groupId, scope, method: 'razorpay' });
      if (p.provider === 'test') {
        await api.post(`/payments/${p.id}/capture`);
        toast('Payment received');
        onPaid?.();
        return;
      }
      const Razorpay = await loadScript('https://checkout.razorpay.com/v1/checkout.js', () => window.Razorpay);
      const upiFirst = {
        display: {
          blocks: { upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] } },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: true },
        },
      };
      await new Promise((resolve) => {
        const rzp = new Razorpay({
          key: p.razorpayKeyId,
          order_id: p.razorpayOrderId,
          amount: Math.round(p.amountInr * 100),
          currency: 'INR',
          name: 'CrowdKart',
          description: p.covers > 1 ? `Payment for ${p.covers} orders` : 'Your order',
          prefill: { name: user?.name || '' },
          theme: { color: '#13804e' },
          ...(method === 'upi' ? { config: upiFirst } : {}),
          handler: async (resp) => {
            try {
              await api.post(`/payments/${p.id}/capture`, resp);
              toast('Payment received');
              onPaid?.();
            } catch (e) { toast({ kind: 'error', text: e.message }); }
            resolve();
          },
          modal: { ondismiss: resolve },
        });
        rzp.on('payment.failed', (r) => toast({ kind: 'error', text: r.error?.description || 'Payment failed. Please try again.' }));
        rzp.open();
      });
    } catch (e) {
      toast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-3 space-y-2">
        {methods.map(({ id, label, desc, Icon }) => (
          <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${method === id ? 'border-brand bg-brand-soft/50' : 'border-line hover:bg-page'}`}>
            <input type="radio" name="paymethod" className="accent-[#2fa866]" checked={method === id} onChange={() => setMethod(id)} />
            <Icon size={20} className="shrink-0 text-sub" />
            <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-sub">{desc}</span></span>
          </label>
        ))}
      </div>
      {method === 'upiapp'
        ? <UpiAppPay groupId={groupId} amountInr={amountInr} existing={upiPayment} onSubmitted={onPaid} />
        : method === 'paypal'
        ? <div ref={ppRef} className="min-h-12" />
        : (
          <button className="btn-primary w-full !py-3" disabled={busy} onClick={start}>
            {busy ? <><Loader2 size={18} className="animate-spin" />Opening payment…</> : `Pay ${inr(amountInr)}${method === 'upi' ? ' with UPI' : ''}`}
          </button>
        )}
      {pay.testMode && method !== 'upiapp' && <p className="mt-2 text-center text-xs text-faint">Test mode: no money is charged yet.</p>}
    </div>
  );
}
