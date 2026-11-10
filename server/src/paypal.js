// PayPal Orders API v2: server-side create + capture, webhook verification. Sandbox by default.
import { config, paypalEnabled } from './config.js';

const base = () => (config.paypal.env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
let tokenCache = { token: null, exp: 0 };

async function accessToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const auth = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64');
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

/** INR amount → PayPal charge amount in the configured currency. */
export function toChargeAmount(amountInr) {
  if (config.paypal.currency === 'INR') return amountInr.toFixed(2);
  return (amountInr / config.paypal.inrPerUnit).toFixed(2);
}

export async function createOrder({ amountInr, referenceId, description }) {
  if (!paypalEnabled()) throw new Error('PayPal not configured');
  const res = await fetch(`${base()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: referenceId,
        description: description.slice(0, 127),
        amount: { currency_code: config.paypal.currency, value: toChargeAmount(amountInr) },
      }],
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || 'PayPal create order failed');
  return j;
}

export async function captureOrder(paypalOrderId) {
  const res = await fetch(`${base()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || 'PayPal capture failed');
  return j;
}

export async function verifyWebhook(headers, event) {
  if (!config.paypal.webhookId || !paypalEnabled()) return false;
  const res = await fetch(`${base()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.paypal.webhookId,
      webhook_event: event,
    }),
  });
  const j = await res.json();
  return j.verification_status === 'SUCCESS';
}
