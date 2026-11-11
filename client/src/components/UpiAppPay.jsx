import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Copy, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { api, inr } from '../api.js';
import { useApp } from '../App.jsx';

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || Boolean(window.Capacitor?.isNativePlatform?.());

/**
 * "Pay with UPI app": opens GPay / PhonePe / Paytm / BHIM with the amount and the shop's UPI ID
 * pre-filled (upi://pay link). On a laptop it shows a QR code to scan with the phone instead.
 * Direct UPI links don't report success back, so the customer enters the 12-digit UTR and the
 * admin confirms it in the admin panel.
 */
export default function UpiAppPay({ groupId, amountInr, existing, onSubmitted }) {
  const { toast } = useApp();
  const [p, setP] = useState(null);
  const [qr, setQr] = useState('');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const phone = isPhone();

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.post('/payments', { groupId, scope: 'mine', method: 'upi' });
      setP(r);
      if (!phone) setQr(await QRCode.toDataURL(r.upiUri, { width: 260, margin: 1 }));
      else window.location.href = r.upiUri; // opens the phone's UPI app chooser
    } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${p?.id || existing?.id}/upi`, { utr });
      toast({ title: 'Payment submitted', text: 'We’ll confirm it shortly and send your rider.' });
      onSubmitted?.();
    } catch (e) { toast({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };

  useEffect(() => { if (existing?.status === 'rejected') setP(null); }, [existing?.status]);

  if (existing?.status === 'submitted') {
    return (
      <div className="rounded-xl bg-sun-soft p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-[#8a6300]"><Loader2 size={16} className="animate-spin" />Confirming your UPI payment</div>
        <p className="mt-1 text-xs text-ink/70">Transaction ID {existing.utr}. Your rider leaves as soon as it’s confirmed.</p>
      </div>
    );
  }

  return (
    <div>
      {existing?.status === 'rejected' && <p className="mb-2 rounded-lg bg-danger/10 p-2.5 text-xs text-danger">Your last UPI payment couldn’t be confirmed{existing.note ? `: ${existing.note}` : ''}. Please try again.</p>}
      {!p ? (
        <button className="btn-primary w-full !py-3" disabled={busy} onClick={start}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ExternalLink size={17} />}Pay {inr(amountInr)} with UPI app
        </button>
      ) : (
        <div className="rise-in rounded-2xl border border-line p-4">
          {phone ? (
            <>
              <p className="text-sm">Your UPI app should have opened with <b>{inr(p.amountInr)}</b> to <b>{p.payeeName}</b>.</p>
              <a href={p.upiUri} className="btn-secondary mt-3 w-full !py-2.5 text-sm"><ExternalLink size={15} />Open UPI app again</a>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm font-semibold">Scan with any UPI app to pay {inr(p.amountInr)}</p>
              {qr && <img src={qr} alt="UPI QR code" className="mx-auto mt-3 h-52 w-52 rounded-xl border border-line" />}
              <p className="mt-2 text-xs text-sub">Google Pay · PhonePe · Paytm · BHIM</p>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-page px-3 py-2 text-xs">
            <span className="truncate">Pay to <b>{p.upiId}</b> · Ref {p.upiRef}</span>
            <button onClick={() => { navigator.clipboard?.writeText(p.upiId); toast('UPI ID copied'); }} className="ml-2 shrink-0 text-brand" aria-label="Copy UPI ID"><Copy size={14} /></button>
          </div>
          <label className="mt-4 block text-xs font-semibold">After paying, enter the 12-digit UPI transaction ID (UTR)</label>
          <input className="input mt-1 !py-2.5 tnum" inputMode="numeric" value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 15))} placeholder="e.g. 4012 3456 7890" />
          <p className="mt-1 text-[11px] text-faint">Find it in your UPI app’s payment details (“UPI Ref No.” or “UTR”).</p>
          <button className="btn-primary mt-3 w-full !py-2.5" disabled={busy || utr.replace(/\s/g, '').length !== 12} onClick={submit}>
            <CheckCircle2 size={16} />I’ve paid
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-faint"><ShieldCheck size={12} />Your order is dispatched once the payment is confirmed</p>
        </div>
      )}
    </div>
  );
}
