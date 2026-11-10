// Razorpay: UPI (GPay, PhonePe, Paytm, BHIM), cards, netbanking and wallets for India.
// Server creates the order, the app opens Razorpay Checkout, the server verifies the signature.
import crypto from 'node:crypto';
import { config } from './config.js';

const auth = () => `Basic ${Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64')}`;

export async function createOrder({ amountInr, receipt, notes }) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: 'INR', receipt: receipt.slice(0, 40), notes }),
  });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error(j.error?.description || 'Could not start the payment'), { status: 502 });
  return j;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Signature returned to the app after a successful checkout. */
export function verifyPayment({ orderId, paymentId, signature }) {
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** X-Razorpay-Signature on webhooks (computed over the raw request body). */
export function verifyWebhook(rawBody, signature) {
  if (!config.razorpay.webhookSecret || !rawBody) return false;
  const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature || '');
}
