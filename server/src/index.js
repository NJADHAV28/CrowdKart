import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { config, aiEnabled, paypalEnabled, googleEnabled, razorpayEnabled, placeProviders } from './config.js';
import * as razorpay from './razorpay.js';
import { load, col, id, reset } from './store.js';
import { CATEGORIES } from './seed.js';
import { cellsAround, haversineKm, validLoc } from './geo.js';
import { explainGroup } from './ai.js';
import { verifyWebhook } from './paypal.js';
import { resumeDeliveries, completeStop, updatePartnerLocation } from './delivery.js';
import { nearbyStores, travelTimes, deliveryEta, deliverable, googleMapsUrl } from './places.js';
import { buildMenu, CATALOG_VERSION } from './catalog.js';
import compression from 'compression';
import * as geocode from './geocode.js';
import * as G from './groups.js';
import * as Admin from './admin.js';
import { getSettings, updateSettings } from './settings.js';
import { searchBrands, getBrand, nearestShopFor } from './brands.js';

load();
// One-time migration: earlier builds used fixed demo zones and demo stores. Drop that data.
if (col('zones').all().length || col('merchants').all().some((m) => !m.source) || col('groups').all().some((g) => g.zoneId)) reset();

for (const m of col('merchants').find((x) => x.menuSource === 'catalogue' && x.catalogVersion !== CATALOG_VERSION)) {
  col('merchants').update(m.id, { items: buildMenu(m.id, m.kind), catalogVersion: CATALOG_VERSION });
}

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '200kb', verify: (req, res, buf) => { req.rawBody = buf; } }));

const sign = (u) => jwt.sign({ uid: u.id }, config.jwtSecret, { expiresIn: '30d' });
function auth(req, res, next) {
  try {
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
    const { uid } = jwt.verify(tok, config.jwtSecret);
    req.user = col('users').get(uid);
    if (!req.user) throw new Error('no user');
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again' });
  }
}
const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.', ...(e.extra || {}) });
  }
};
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, merchantId: u.merchantId, location: u.location, address: u.address, area: u.area, flat: u.flat, phone: u.phone || '', vehicle: u.vehicle, online: Boolean(u.online) });
const cleanPhone = (p) => String(p || '').replace(/[^0-9+ ]/g, '').trim().slice(0, 16);
const groupFor = (req) => {
  const g = col('groups').get(req.params.id);
  if (!g) throw G.httpError(404, 'Order not found');
  return g;
};
const locFrom = (q) => {
  const l = [Number(q.lat), Number(q.lng)];
  if (!validLoc(l)) throw G.httpError(400, 'A valid location is required');
  return l;
};
const publicStore = (m, tt) => ({
  id: m.id, name: m.name, category: m.category, kind: m.kind, cuisine: m.cuisine, address: m.address,
  location: m.location, rating: m.rating ?? null, ratingCount: m.ratingCount ?? null, openNow: m.openNow ?? null,
  openingHours: m.openingHours ?? null, prepMin: m.prepMin, groupDiscount: m.groupDiscount,
  distanceKm: tt?.km ?? null, etaMin: tt ? deliveryEta(m, tt) : null,
});

app.get('/api/health', (req, res) => res.json({ ok: true, ai: aiEnabled(), razorpay: razorpayEnabled(), paypal: paypalEnabled(), places: placeProviders() }));
app.get('/api/config', (req, res) => res.json({
  categories: CATEGORIES,
  payments: {
    razorpay: razorpayEnabled(),
    paypal: paypalEnabled() ? { clientId: config.paypal.clientId, currency: config.paypal.currency, inrPerUnit: config.paypal.inrPerUnit } : null,
    testMode: !razorpayEnabled() && !paypalEnabled(),
    upi: getSettings().upiId ? { vpa: getSettings().upiId, name: getSettings().payeeName } : null,
  },
  deliveryRadiusKm: config.places.radiusKm,
  cartMaxItems: config.cartMaxItems,
  cartMaxShops: config.cartMaxShops,
}));

// ---------- location ----------
app.get('/api/geo/search', wrap(async (req) => {
  const near = req.query.lat ? locFrom(req.query) : null;
  return geocode.search(req.query.q, near);
}));
app.get('/api/geo/reverse', wrap(async (req) => geocode.reverse(locFrom(req.query))));

// Public list used by merchants to find their own store when signing up.
app.get('/api/places/nearby', wrap(async (req) => {
  const loc = locFrom(req.query);
  const stores = (await nearbyStores(loc)).filter((m) => m.category !== 'hotel');
  return stores.map((m) => ({ id: m.id, name: m.name, category: m.category, address: m.address, distanceKm: Math.round(haversineKm(loc, m.location) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 60);
}));

// ---------- auth ----------
app.post('/api/auth/login', wrap(async (req) => {
  const { name, role = 'customer', location, address, flat, merchantId } = req.body || {};
  if (!name || String(name).trim().length < 2) throw G.httpError(400, 'Please enter your name');
  const clean = String(name).trim().slice(0, 40);
  if (role === 'rider') {
    const phone = cleanPhone(req.body?.phone);
    if (phone.replace(/\D/g, '').length < 10) throw G.httpError(400, 'Please enter a valid phone number');
    let u = col('users').findOne((x) => x.role === 'rider' && x.phone === phone);
    if (!u) u = col('users').insert({ id: id('usr'), name: clean, role: 'rider', phone, vehicle: String(req.body?.vehicle || 'Bike').slice(0, 20), online: false, createdAt: Date.now() });
    else col('users').update(u.id, { name: clean });
    return { token: sign(u), user: publicUser(u) };
  }
  if (role === 'merchant') {
    const m = col('merchants').get(merchantId);
    if (!m) throw G.httpError(400, 'Please choose your store');
    let u = col('users').findOne((x) => x.role === 'merchant' && x.merchantId === merchantId);
    if (!u) u = col('users').insert({ id: id('usr'), name: clean, role: 'merchant', merchantId, location: m.location, createdAt: Date.now() });
    return { token: sign(u), user: publicUser(u) };
  }
  if (!validLoc(location)) throw G.httpError(400, 'Please set your delivery location');
  const loc = location.map(Number);
  const place = address ? { label: String(address).slice(0, 200), short: null } : await geocode.reverse(loc);
  const short = place.short || (await geocode.reverse(loc)).short;
  const u = col('users').insert({
    id: id('usr'), name: clean, role: 'customer', location: loc, address: place.label, area: short,
    flat: String(flat || '').slice(0, 60), createdAt: Date.now(),
  });
  return { token: sign(u), user: publicUser(u) };
}));

app.get('/api/me', auth, wrap((req) => ({ user: publicUser(req.user) })));
app.patch('/api/me', auth, wrap(async (req) => {
  const { location, address, flat, phone } = req.body || {};
  const patch = {};
  if (phone != null) patch.phone = cleanPhone(phone);
  if (validLoc(location)) {
    patch.location = location.map(Number);
    const r = await geocode.reverse(patch.location);
    patch.address = address ? String(address).slice(0, 200) : r.label;
    patch.area = r.short;
  }
  if (flat != null) patch.flat = String(flat).slice(0, 60);
  return { user: publicUser(col('users').update(req.user.id, patch)) };
}));

// ---------- stores ----------
app.get('/api/merchants', auth, wrap(async (req) => {
  const stores = await deliveringStores(req.user.location);
  const tt = await travelTimes(req.user.location, stores);
  return stores.map((m) => publicStore(m, tt.get(m.id))).sort((a, b) => (a.etaMin ?? 99) - (b.etaMin ?? 99));
}));
app.get('/api/merchants/:id', auth, wrap(async (req) => {
  const m = col('merchants').get(req.params.id);
  if (!m) throw G.httpError(404, 'Store not found');
  const tt = req.user.location ? (await travelTimes(req.user.location, [m])).get(m.id) : null;
  return { ...publicStore(m, tt), items: m.items, phone: m.phone || null };
}));

// The nearest stores that can deliver (capped so delivery-time lookups stay fast)
// Capped per type (bakeries, cafés, restaurants, grocery…) so one busy category can't crowd out the others.
async function deliveringStores(loc, perType = 60) {
  const type = (m) => (m.category === 'food' ? (['bakery', 'cafe'].includes(m.kind) ? m.kind : 'food') : m.category);
  const sorted = (await nearbyStores(loc)).filter(deliverable)
    .map((m) => [m, haversineKm(loc, m.location)]).sort((a, b) => a[1] - b[1]);
  const taken = {};
  return sorted.filter(([m]) => (taken[type(m)] = (taken[type(m)] || 0) + 1) <= perType).map(([m]) => m);
}

// Everything around you (restaurants, hotels, shops, bakeries…) for the "Places near you" map
app.get('/api/places/explore', auth, wrap(async (req) => {
  const loc = req.query.lat ? locFrom(req.query) : req.user.location;
  const radiusKm = Math.min(Math.max(Number(req.query.radius) || config.places.radiusKm, 0.5), config.places.radiusKm);
  const all = (await nearbyStores(loc)).filter((m) => haversineKm(m.location, loc) <= radiusKm);
  return {
    center: loc,
    radiusKm,
    providers: placeProviders(),
    places: all.map((m) => ({
      id: m.id, name: m.name, category: m.category, kind: m.kind, cuisine: m.cuisine, address: m.address,
      location: m.location, rating: m.rating ?? null, ratingCount: m.ratingCount ?? null, openNow: m.openNow ?? null,
      openingHours: m.openingHours ?? null, phone: m.phone ?? null, source: m.source,
      distanceKm: Math.round(haversineKm(loc, m.location) * 10) / 10,
      orderable: deliverable(m), googleMapsUrl: googleMapsUrl(m),
    })).sort((a, b) => a.distanceKm - b.distanceKm),
  };
}));

// All products from stores that deliver to you (Popular items, search, categories)
app.get('/api/products', auth, wrap(async (req) => {
  const stores = await deliveringStores(req.user.location);
  const tt = await travelTimes(req.user.location, stores);
  const q = String(req.query.q || '').trim().toLowerCase();
  const tag = String(req.query.tag || '');
  const out = [];
  for (const m of stores) {
    const s = publicStore(m, tt.get(m.id));
    for (const it of m.items) {
      if (tag && it.tag !== tag) continue;
      if (q && !`${it.name} ${it.tag} ${m.name}`.toLowerCase().includes(q)) continue;
      out.push({ ...it, store: { id: s.id, name: s.name, kind: s.kind, etaMin: s.etaMin, distanceKm: s.distanceKm } });
    }
  }
  // Every product once, offered by the fastest shop that stocks it (cheapest on a tie).
  // ?all=1 returns every shop's copy instead (used by "other shops selling this").
  const tags = [...new Set(stores.flatMap((m) => m.items.map((i) => i.tag)))];
  if (req.query.all) return { products: out, tags };
  const best = new Map();
  for (const p of out) {
    const b = best.get(p.id);
    const eta = (x) => x.store.etaMin ?? 99;
    if (!b || eta(p) < eta(b) || (eta(p) === eta(b) && p.price < b.price)) best.set(p.id, p);
  }
  const list = [...best.values()].sort((a, b) => (a.store.etaMin ?? 99) - (b.store.etaMin ?? 99));
  return { products: list.slice(0, Number(req.query.limit) || 1000), tags };
}));

// Branded products (Open Food Facts) and the nearest shop that will supply them
const brandShop = async (user) => {
  const s = nearestShopFor(user.location, await deliveringStores(user.location));
  return s && { id: s.id, name: s.name, kind: s.kind, distanceKm: Math.round(haversineKm(user.location, s.location) * 10) / 10 };
};
app.get('/api/brands/search', auth, wrap(async (req) => {
  const [products, shop] = await Promise.all([searchBrands(req.query.q), brandShop(req.user)]);
  return { products, shop };
}));
app.get('/api/brands/:id', auth, wrap(async (req) => {
  const p = await getBrand(req.params.id);
  if (!p) throw G.httpError(404, 'Product not found');
  return { product: p, shop: await brandShop(req.user) };
}));

// One checkout for a cart with items from several shops: one order per shop, all in the same
// delivery group, so one rider collects from every shop and the customer pays once.
app.post('/api/checkout', auth, wrap(async (req) => {
  const { lines = [], windowMin, promo, preferredGroupId, tip = 0, instructions = [] } = req.body || {};
  if (!Array.isArray(lines) || !lines.length) throw G.httpError(400, 'Your cart is empty');
  const totalQty = lines.reduce((s, l) => s + Math.max(0, Math.floor(Number(l.qty) || 0)), 0);
  if (totalQty > config.cartMaxItems) throw G.httpError(400, `A cart can have at most ${config.cartMaxItems} items`);
  const byStore = new Map();
  for (const l of lines) {
    const qty = Math.max(1, Math.min(config.cartMaxItems, Math.floor(Number(l.qty) || 0)));
    const m = col('merchants').get(l.merchantId);
    if (!m || !m.items?.length) throw G.httpError(400, 'One of the shops in your cart is no longer available');
    let line;
    if (String(l.itemId).startsWith('off:')) {
      const b = await getBrand(l.itemId);
      if (!b) throw G.httpError(400, 'One of the products is no longer available');
      line = { itemId: b.id, name: b.name, price: b.price, qty, img: b.img, unit: b.unit, approxPrice: !b.priceExact };
    } else {
      const it = m.items.find((x) => x.id === l.itemId);
      if (!it) throw G.httpError(400, `${m.name} no longer sells one of the items in your cart`);
      line = { itemId: it.id, name: it.name, price: it.price, qty, img: it.img || null, unit: it.unit || null };
    }
    if (!byStore.has(m.id)) byStore.set(m.id, new Map());
    const prev = byStore.get(m.id).get(line.itemId);
    byStore.get(m.id).set(line.itemId, prev ? { ...prev, qty: prev.qty + qty } : line);
  }
  if (byStore.size > config.cartMaxShops) throw G.httpError(400, `You can order from up to ${config.cartMaxShops} shops at once`);
  const basketId = id('bsk');
  let groupId = null;
  const placed = [];
  for (const [merchantId, items] of byStore) {
    // The tip is added once (to the first shop's order); instructions go to every shop.
    const r = G.createOrderIntent(req.user, { merchantId, windowMin, promo, preferredGroupId, basketId, intoGroupId: groupId, resolved: [...items.values()], tip: placed.length ? 0 : tip, instructions });
    groupId = groupId || r.groupId;
    placed.push(r);
  }
  // Pay straight away unless the admin set a wait-for-neighbours time
  if (!getSettings().waitMinutes) G.lockGroup(col('groups').get(groupId));
  return { groupId, orders: placed.length, joinedExisting: placed[0].joinedExisting, alias: placed[0].alias };
}));

app.post('/api/promo', auth, wrap((req) => {
  const pct = G.promoPct(req.body?.code);
  if (!pct) throw G.httpError(400, 'This code isn’t valid');
  return { code: String(req.body.code).toUpperCase(), pct };
}));

// ---------- crowd radar, orders, groups ----------
app.get('/api/radar', auth, wrap((req) => G.radarView(req.user)));
app.post('/api/orders', auth, wrap((req) => G.createOrderIntent(req.user, req.body || {})));
app.get('/api/orders/mine', auth, wrap((req) => G.myOrders(req.user)));
app.get('/api/groups/:id', auth, wrap((req) => G.groupView(groupFor(req), req.user)));
app.post('/api/groups/:id/lock', auth, wrap((req) => {
  const g = groupFor(req);
  if (!G.memberOf(g, req.user.id)) throw G.httpError(403, 'Not part of this order');
  G.lockGroup(g);
  return G.groupView(g, req.user);
}));
app.post('/api/groups/:id/leave', auth, wrap((req) => { G.leaveGroup(groupFor(req), req.user); return { ok: true }; }));
app.get('/api/groups/:id/insight', auth, wrap(async (req) => {
  const g = groupFor(req);
  const view = G.groupView(g, req.user);
  const key = `${g.status}:${g.members.length}`;
  if (g.insight?.key === key) return { text: g.insight.text };
  const out = await explainGroup({
    participants: view.participants, stores: view.plan?.stores,
    plan: { type: view.plan?.type, reason: view.plan?.reason, ridersUsed: view.plan?.ridersUsed, ridersAvoided: view.plan?.ridersAvoided },
    deliverySaved: view.savings.deliverySaved,
  });
  col('groups').update(g.id, { insight: { key, text: out.text } });
  return { text: out.text };
}));

// ---------- payments ----------
app.post('/api/payments', auth, wrap((req) => {
  const g = col('groups').get(req.body?.groupId);
  if (!g) throw G.httpError(404, 'Order not found');
  return G.createPayment(g, req.user, req.body?.scope, req.body?.method);
}));
app.post('/api/payments/:id/upi', auth, wrap((req) => G.submitUpi(req.user, req.params.id, req.body?.utr)));
app.post('/api/payments/:id/capture', auth, wrap((req) => G.capturePayment(req.user, req.params.id, req.body || {})));
app.post('/api/razorpay/webhook', wrap((req) => {
  if (!razorpay.verifyWebhook(req.rawBody, req.headers['x-razorpay-signature'])) throw G.httpError(400, 'Webhook signature not verified');
  const ev = req.body;
  const orderId = ev.payload?.payment?.entity?.order_id || ev.payload?.order?.entity?.id;
  if (['payment.captured', 'order.paid'].includes(ev.event) && orderId) {
    const p = col('payments').findOne((x) => x.razorpayOrderId === orderId);
    if (p) G.markCaptured(p);
  }
  return { received: true };
}));
app.post('/api/paypal/webhook', wrap(async (req) => {
  if (!(await verifyWebhook(req.headers, req.body))) throw G.httpError(400, 'Webhook signature not verified');
  if (req.body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const orderId = req.body.resource?.supplementary_data?.related_ids?.order_id;
    const p = col('payments').findOne((x) => x.paypalOrderId === orderId);
    if (p) G.markCaptured(p);
  }
  return { received: true };
}));

// ---------- admin panel ----------
app.post('/api/auth/admin', wrap((req) => {
  const u = Admin.checkAdmin(String(req.body?.username || ''), String(req.body?.password || ''), req.ip);
  return { token: sign(u), user: publicUser(u) };
}));
const adminOnly = (req) => { if (req.user.role !== 'admin') throw G.httpError(403, 'Admins only'); };
app.get('/api/admin/overview', auth, wrap((req) => { adminOnly(req); return Admin.overview(); }));
app.get('/api/admin/settings', auth, wrap((req) => { adminOnly(req); return getSettings(); }));
app.put('/api/admin/settings', auth, wrap((req) => { adminOnly(req); return updateSettings(req.body || {}); }));
app.get('/api/admin/payments', auth, wrap((req) => { adminOnly(req); return Admin.upiPayments(req.query.status); }));
app.post('/api/admin/payments/:id/confirm', auth, wrap((req) => { adminOnly(req); Admin.confirmUpi(req.params.id); return Admin.upiPayments(); }));
app.post('/api/admin/payments/:id/reject', auth, wrap((req) => { adminOnly(req); Admin.rejectUpi(req.params.id, req.body?.note); return Admin.upiPayments(); }));

// ---------- delivery partners ----------
const riderOnly = (req) => { if (req.user.role !== 'rider') throw G.httpError(403, 'Delivery partner accounts only'); };
app.post('/api/rider/status', auth, wrap((req) => {
  riderOnly(req);
  const patch = { online: Boolean(req.body?.online) };
  if (validLoc(req.body?.location)) Object.assign(patch, { location: req.body.location.map(Number), locAt: Date.now() });
  return { user: publicUser(col('users').update(req.user.id, patch)) };
}));
app.post('/api/rider/location', auth, wrap((req) => {
  riderOnly(req);
  if (!validLoc(req.body?.location)) throw G.httpError(400, 'Invalid location');
  updatePartnerLocation(req.user, req.body.location.map(Number));
  return { ok: true };
}));
app.get('/api/rider/jobs', auth, wrap((req) => { riderOnly(req); return G.riderJobs(req.user); }));
app.post('/api/rider/jobs/:id/stops/:idx/done', auth, wrap((req) => {
  riderOnly(req);
  completeStop(req.user, req.params.id, req.params.idx, io);
  return G.riderJobs(req.user);
}));

// Road route from the rider to this customer's next point (their shop, then their door)
app.get('/api/groups/:id/route', auth, wrap(async (req) => G.customerRoute(groupFor(req), req.user)));

// ---------- merchant ----------
const merchantOnly = (req) => { if (req.user.role !== 'merchant') throw G.httpError(403, 'Store accounts only'); };
app.get('/api/merchant/dashboard', auth, wrap((req) => { merchantOnly(req); return G.merchantDashboard(req.user); }));
app.put('/api/merchant/menu', auth, wrap((req) => { merchantOnly(req); return { items: G.updateMenu(req.user, req.body?.items).items }; }));

// ---------- product photo proxy (Open Food Facts), cached on disk ----------
const imgDir = path.join(config.dataDir, 'imgcache');
app.get(/^\/img\/off\/([0-9/]+\/[a-z0-9_.]+\.jpg)$/i, wrap(async (req, res) => {
  const rel = req.params[0];
  const file = path.join(imgDir, rel.replace(/\//g, '_'));
  res.set('Cache-Control', 'public, max-age=2592000');
  if (fs.existsSync(file)) { res.type('jpg').send(fs.readFileSync(file)); return; }
  const r = await fetch(`https://images.openfoodfacts.org/images/products/${rel}`, { headers: { 'User-Agent': config.places.userAgent } });
  if (!r.ok) throw G.httpError(404, 'Image not found');
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(file, buf);
  res.type('jpg').send(buf);
}));

// ---------- static client ----------
if (fs.existsSync(config.clientDist)) {
  // Product photos and hashed build files never change, so let browsers keep them.
  app.use('/products', express.static(path.join(config.clientDist, 'products'), { maxAge: '30d' }));
  app.use('/assets', express.static(path.join(config.clientDist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(config.clientDist, { maxAge: 0 }));
  app.get(/^\/(?!api|socket\.io).*/, (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// ---------- realtime ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
G.setIO(io);
io.use((socket, next) => {
  try {
    const { uid } = jwt.verify(socket.handshake.auth?.token || '', config.jwtSecret);
    socket.user = col('users').get(uid);
    return socket.user ? next() : next(new Error('unauthorized'));
  } catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => {
  const u = col('users').get(socket.user.id);
  socket.join(`user:${u.id}`);
  if (u.role === 'customer' && u.location) for (const c of cellsAround(u.location, 1)) socket.join(`cell:${c}`);
  if (u.merchantId) socket.join(`merchant:${u.merchantId}`);
  socket.on('group:watch', (groupId) => {
    const g = col('groups').get(groupId);
    if (g && G.memberOf(g, u.id)) socket.join(`group:${groupId}`);
  });
});

setInterval(G.tick, 2000);
resumeDeliveries(io, (gid) => G.onDeliveredById(gid));

export function start(port = config.port) {
  return new Promise((resolve) => {
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        // If it's CrowdKart itself that's already running, just say where it is and stop cleanly.
        fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(3000) })
          .then((r) => r.json()).then((h) => h?.ok === true).catch(() => false)
          .then((isCrowdKart) => {
            if (isCrowdKart) {
              console.log(`\n  CrowdKart is already running. Open it in your browser:`);
              console.log(`    http://localhost:5173  (if you started "npm run dev")`);
              console.log(`    http://localhost:${port}`);
              console.log('  To restart it, press Ctrl+C in the window where it is running, then run npm start again.\n');
              process.exit(0);
            }
            console.error(`\n  Port ${port} is used by another program. Start CrowdKart on another port:`);
            console.error('    PowerShell:  $env:PORT=4001; npm start      Command Prompt:  set PORT=4001 && npm start\n');
            process.exit(1);
          });
        return;
      }
      throw e;
    });
    server.listen(port, () => {
      console.log(`\n  CrowdKart server on http://localhost:${port}`);
      console.log(`  Stores: ${config.places.fixture ? 'fixture file' : placeProviders().join(' + ')}`);
      console.log(`  AI: ${aiEnabled() ? config.ai.model : 'off (set AI_API_KEY)'} · Payments: ${[razorpayEnabled() && 'Razorpay (UPI)', paypalEnabled() && `PayPal ${config.paypal.env}`].filter(Boolean).join(' + ') || 'test mode (set RAZORPAY_KEY_ID/SECRET)'}\n`);
      resolve(server);
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain || process.env.CROWDKART_AUTOSTART === '1') start();
