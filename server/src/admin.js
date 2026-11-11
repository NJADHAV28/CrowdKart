// Admin panel: sign-in, overview, UPI payment verification and settings.
import crypto from 'node:crypto';
import { config } from './config.js';
import { col } from './store.js';
import { markCaptured, httpError } from './groups.js';

// ---------- sign-in (credentials come from server/.env, never from the code) ----------
const failures = new Map(); // ip -> { n, until }
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function checkAdmin(username, password, ip) {
  if (!config.admin.password) throw httpError(503, 'Admin sign-in isn’t set up. Add ADMIN_USERNAME and ADMIN_PASSWORD to server/.env and restart.');
  const f = failures.get(ip);
  if (f && f.until > Date.now()) throw httpError(429, 'Too many wrong attempts. Try again in 15 minutes.');
  const ok = crypto.timingSafeEqual(sha(username), sha(config.admin.username)) & crypto.timingSafeEqual(sha(password), sha(config.admin.password));
  if (!ok) {
    const n = (f?.n || 0) + 1;
    failures.set(ip, { n, until: n >= 5 ? Date.now() + 15 * 60000 : 0 });
    throw httpError(401, 'Wrong username or password');
  }
  failures.delete(ip);
  let u = col('users').get('usr_admin');
  if (!u) u = col('users').insert({ id: 'usr_admin', name: 'Admin', role: 'admin', createdAt: Date.now() });
  return u;
}

// ---------- overview ----------
const ref = (id) => id.slice(4, 12).toUpperCase();

export function overview() {
  const users = col('users').all();
  const orders = col('orders').all();
  const payments = col('payments').all();
  const dayAgo = Date.now() - 24 * 3600e3;
  const merchants = Object.fromEntries(col('merchants').all().map((m) => [m.id, m.name]));
  const recent = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25).map((o) => ({
    ref: ref(o.id), createdAt: o.createdAt, status: o.status, shop: merchants[o.merchantId] || 'Shop',
    customer: users.find((u) => u.id === o.userId)?.name || 'Customer', items: o.items.reduce((n, i) => n + i.qty, 0), subtotal: o.subtotal, tip: o.tip || 0,
  }));
  return {
    counts: {
      customers: users.filter((u) => u.role === 'customer').length,
      merchants: users.filter((u) => u.role === 'merchant').length,
      riders: users.filter((u) => u.role === 'rider').length,
      ridersOnline: users.filter((u) => u.role === 'rider' && u.online).length,
      orders: orders.length,
      ordersToday: orders.filter((o) => o.createdAt > dayAgo).length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      revenue: payments.filter((p) => p.status === 'captured').reduce((s, p) => s + p.amountInr, 0),
      upiToVerify: payments.filter((p) => p.provider === 'upi' && p.status === 'submitted').length,
    },
    recent,
  };
}

// ---------- UPI payments: customers submit their UTR, the admin confirms ----------
export function upiPayments(status) {
  const users = col('users');
  return col('payments').find((p) => p.provider === 'upi' && p.status !== 'created' && (!status || p.status === status))
    .sort((a, b) => (b.submittedAt || b.createdAt) - (a.submittedAt || a.createdAt)).slice(0, 100)
    .map((p) => ({
      id: p.id, status: p.status, amountInr: p.amountInr, utr: p.utr || null, createdAt: p.createdAt, submittedAt: p.submittedAt || null,
      customer: users.get(p.userId)?.name || 'Customer', orders: p.covers.length, groupRef: ref(p.groupId), note: p.adminNote || null,
    }));
}

export function confirmUpi(id) {
  const p = col('payments').get(id);
  if (!p || p.provider !== 'upi') throw httpError(404, 'Payment not found');
  if (p.status === 'captured') return p;
  if (p.status !== 'submitted') throw httpError(409, 'The customer hasn’t submitted this payment yet');
  markCaptured(p); // marks the orders paid; dispatches the rider once everyone has paid
  return col('payments').get(id);
}

export function rejectUpi(id, note) {
  const p = col('payments').get(id);
  if (!p || p.provider !== 'upi') throw httpError(404, 'Payment not found');
  if (p.status === 'captured') throw httpError(409, 'Already confirmed');
  return col('payments').update(id, { status: 'rejected', adminNote: String(note || 'Payment not received').slice(0, 120), rejectedAt: Date.now() });
}
