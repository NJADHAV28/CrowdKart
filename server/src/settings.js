// App-wide settings, edited from the admin panel and stored in the database.
import { col } from './store.js';

const DEFAULTS = {
  upiId: '', // e.g. yourname@okaxis — where "Pay with UPI app" payments go
  payeeName: 'CrowdKart', // name shown in the customer's UPI app
  waitMinutes: 0, // 0 = customers pay right after placing the order; >0 = wait for neighbours first
};
export const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export function getSettings() {
  const s = col('settings').get('app');
  return { ...DEFAULTS, ...(s || {}) };
}

export function updateSettings(patch = {}) {
  const next = {};
  if (patch.upiId !== undefined) {
    const v = String(patch.upiId).trim();
    if (v && !UPI_RE.test(v)) throw Object.assign(new Error('That doesn’t look like a UPI ID (for example name@okaxis)'), { status: 400 });
    next.upiId = v;
  }
  if (patch.payeeName !== undefined) next.payeeName = String(patch.payeeName).trim().slice(0, 40) || DEFAULTS.payeeName;
  if (patch.waitMinutes !== undefined) {
    const m = Math.round(Number(patch.waitMinutes));
    if (!Number.isFinite(m) || m < 0 || m > 30) throw Object.assign(new Error('Wait time must be between 0 and 30 minutes'), { status: 400 });
    next.waitMinutes = m;
  }
  if (col('settings').get('app')) col('settings').update('app', next);
  else col('settings').insert({ id: 'app', ...DEFAULTS, ...next });
  return getSettings();
}

/** upi://pay link that opens any UPI app (GPay, PhonePe, Paytm, BHIM…) with everything pre-filled. */
export function upiUri({ amountInr, ref }) {
  const s = getSettings();
  const q = new URLSearchParams({ pa: s.upiId, pn: s.payeeName, am: amountInr.toFixed(2), cu: 'INR', tn: `CrowdKart ${ref}` });
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}
