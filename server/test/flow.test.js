import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.CROWDKART_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-'));
process.env.CROWDKART_PLACES_FIXTURE = path.join(here, 'fixture-places.json');
process.env.RIDER_SIM_SPEED_KMH = '4000';
process.env.AI_API_KEY = '';
process.env.PAYPAL_CLIENT_ID = '';
process.env.GOOGLE_MAPS_API_KEY = '';

let base, server;
const call = async (method, url, body, token) => {
  const r = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
};
// Homes a few dozen metres apart in the same society
const HOME = [16.8528, 74.6094];
const near = (dLat, dLng) => [HOME[0] + dLat, HOME[1] + dLng];
const login = async (name, location = HOME) => (await call('POST', '/api/auth/login', { name, location, address: `${name}'s flat, Test Society`, flat: 'B-2' })).body.token;
const firstItem = async (tok, store) => (await call('GET', `/api/merchants/${store}`, null, tok)).body.items[0].id;
const order = async (tok, store) => call('POST', '/api/orders', { merchantId: store, items: [{ itemId: await firstItem(tok, store), qty: 1 }], windowMin: 15 }, tok);
const waitFor = async (fn, ms = 45000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('timeout');
};

before(async () => {
  const mod = await import('../src/index.js');
  server = await mod.start(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => { server.close(); setTimeout(() => process.exit(0), 50); });

test('real-location login requires a location and lists nearby stores with ETA', async () => {
  const bad = await call('POST', '/api/auth/login', { name: 'NoLoc' });
  assert.equal(bad.status, 400);
  const tok = await login('Asha');
  const stores = (await call('GET', '/api/merchants', null, tok)).body;
  assert.ok(stores.length >= 4);
  assert.ok(stores.every((s) => s.etaMin > 0 && s.distanceKm > 0));
  const pizza = (await call('GET', '/api/merchants/fx_pizza', null, tok)).body;
  assert.ok(pizza.items.some((i) => /Pizza/.test(i.name)), 'cuisine-matched starting menu');
});

test('multi-store neighbours → one rider, private views, split payment, delivery', async () => {
  const [a, b, c] = await Promise.all([login('Alice'), login('Bob', near(0.0008, 0.0004)), login('Chitra', near(-0.0006, 0.0007))]);
  const ra = await order(a, 'fx_pizza');
  const rb = await order(b, 'fx_burger');
  const rc = await order(c, 'fx_grocery');
  assert.equal(rb.body.groupId, ra.body.groupId);
  assert.equal(rc.body.groupId, ra.body.groupId);
  const gid = ra.body.groupId;

  const raw = JSON.stringify((await call('GET', `/api/groups/${gid}`, null, b)).body);
  assert.ok(!raw.includes('Alice') && !raw.includes('Chitra'), 'no other names');
  assert.ok(!raw.includes('Corner Pizza') && !raw.includes('Daily Needs'), 'no other stores');
  assert.ok(!raw.includes("Alice's flat"), 'no other addresses');

  const far = await login('FarAway', [16.87, 74.64]);
  assert.equal((await call('GET', '/api/radar', null, far)).body.opportunities.length, 0, 'far users do not see the group');
  const d = await login('Dev', near(0.0003, -0.0003));
  assert.equal((await call('GET', '/api/radar', null, d)).body.opportunities[0].participants, 3);

  const locked = (await call('POST', `/api/groups/${gid}/lock`, null, a)).body;
  assert.equal(locked.plan.type, 'batched');
  assert.equal(locked.plan.ridersUsed, 1);
  assert.ok(locked.me.bill.total < locked.me.bill.soloTotal);
  assert.ok(locked.myRider.myDropIndex > locked.myRider.myPickupIndex);

  for (const tok of [a, b, c]) {
    const p = await call('POST', '/api/payments', { groupId: gid, scope: 'mine' }, tok);
    assert.equal(p.status, 200, JSON.stringify(p.body));
    await call('POST', `/api/payments/${p.body.id}/capture`, null, tok);
  }
  const done = await waitFor(async () => { const v = (await call('GET', `/api/groups/${gid}`, null, a)).body; return v.status === 'delivered' && v; });
  assert.equal(done.savings.status, 'confirmed');
});

test('one neighbour pays for the whole group', async () => {
  const [a, b] = await Promise.all([login('Esha', near(0.002, 0.002)), login('Farhan', near(0.0021, 0.0022))]);
  const ra = await order(a, 'fx_snacks');
  const rb = await order(b, 'fx_snacks');
  assert.equal(rb.body.groupId, ra.body.groupId);
  const v = (await call('POST', `/api/groups/${ra.body.groupId}/lock`, null, b)).body;
  assert.equal(v.plan.type, 'combined');
  assert.equal(v.me.bill.discountPct, 5);
  const p = await call('POST', '/api/payments', { groupId: ra.body.groupId, scope: 'group' }, b);
  assert.equal(p.body.covers, 2);
  await call('POST', `/api/payments/${p.body.id}/capture`, null, b);
  assert.equal((await call('GET', `/api/groups/${ra.body.groupId}`, null, a)).body.me.pay, 'covered');
});

test('merchant can claim a real store and edit its menu', async () => {
  const list = (await call('GET', `/api/places/nearby?lat=${HOME[0]}&lng=${HOME[1]}`)).body;
  assert.ok(list.find((s) => s.id === 'fx_stationery'));
  const m = (await call('POST', '/api/auth/login', { role: 'merchant', name: 'Owner', merchantId: 'fx_stationery' })).body;
  const r = await call('PUT', '/api/merchant/menu', { items: [{ name: 'Graph Book', price: 75 }] }, m.token);
  assert.equal(r.status, 200);
  const tok = await login('Gita');
  const s = (await call('GET', '/api/merchants/fx_stationery', null, tok)).body;
  assert.deepEqual(s.items.map((i) => i.name), ['Graph Book']);
});

test('places map lists everything nearby, including hotels, but only stores are orderable', async () => {
  const tok = await login('Hema');
  const r = (await call('GET', '/api/places/explore', null, tok)).body;
  const hotel = r.places.find((p) => p.id === 'fx_hotel');
  assert.ok(hotel, 'hotel listed on the map');
  assert.equal(hotel.orderable, false);
  assert.match(hotel.googleMapsUrl, /^https:\/\/www\.google\.com\/maps\/search\//);
  assert.ok(r.places.some((p) => p.orderable), 'shops are orderable');
  const stores = (await call('GET', '/api/merchants', null, tok)).body;
  assert.ok(!stores.some((s) => s.id === 'fx_hotel'), 'hotels are not in the shop list');
});

test('multi-shop cart: one checkout, one group, one payment; 25-item limit; brand price set by server', async () => {
  const { col } = await import('../src/store.js');
  col('brandProducts').insert({ id: 'off:8901491101837', code: '8901491101837', name: "Lay's Classic Salted", brand: "Lay's", unit: '50 g', img: 'https://images.openfoodfacts.org/x.jpg', price: 20, priceExact: true, tag: 'Packaged' });
  const tok = await login('Kavya', near(-0.004, 0.003));
  const pizza = await firstItem(tok, 'fx_pizza');
  const tooMany = await call('POST', '/api/checkout', { lines: [{ merchantId: 'fx_pizza', itemId: pizza, qty: 26 }] }, tok);
  assert.equal(tooMany.status, 400);
  const r = await call('POST', '/api/checkout', { lines: [
    { merchantId: 'fx_pizza', itemId: pizza, qty: 2 },
    { merchantId: 'fx_grocery', itemId: await firstItem(tok, 'fx_grocery'), qty: 1 },
    { merchantId: 'fx_grocery', itemId: 'off:8901491101837', qty: 3, price: 1 },
  ] }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.orders, 2, 'one order per shop');
  const v = (await call('POST', `/api/groups/${r.body.groupId}/lock`, null, tok)).body;
  assert.equal(v.me.orders.length, 2);
  assert.equal(v.participants, 1, 'still one person');
  const lays = v.me.orders.flatMap((o) => o.items).find((i) => i.itemId === 'off:8901491101837');
  assert.equal(lays.price, 20, 'price comes from the server, not the app');
  const p = await call('POST', '/api/payments', { groupId: r.body.groupId, scope: 'mine' }, tok);
  assert.equal(p.body.covers, 2, 'one payment covers both shop orders');
  await call('POST', `/api/payments/${p.body.id}/capture`, null, tok);
  const after = (await call('GET', `/api/groups/${r.body.groupId}`, null, tok)).body;
  assert.ok(['paid', 'in_transit', 'delivered'].includes(after.status));
  assert.equal(after.me.pay, 'paid');
});

test('tip and delivery instructions are saved and billed', async () => {
  const tok = await login('Lata', near(0.006, -0.004));
  const r = await call('POST', '/api/checkout', { tip: 20, instructions: ['Leave at the door', 'Note: Gate 2', 'rm -rf'], lines: [{ merchantId: 'fx_snacks', itemId: await firstItem(tok, 'fx_snacks'), qty: 1 }] }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const v = (await call('POST', `/api/groups/${r.body.groupId}/lock`, null, tok)).body;
  assert.equal(v.me.bill.tip, 20);
  assert.equal(v.me.bill.total, v.me.bill.subtotal - v.me.bill.discount + v.me.bill.deliveryShare + 20);
  const m = (await call('POST', '/api/auth/login', { role: 'merchant', name: 'Snack owner', merchantId: 'fx_snacks' })).body;
  const d = (await call('GET', '/api/merchant/dashboard', null, m.token)).body;
  const o = d.groupOrders.find((g) => g.groupId === r.body.groupId).orders[0];
  assert.deepEqual(o.instructions, ['Leave at the door', 'Note: Gate 2'], 'unknown instructions dropped');
});

test('delivery partner: goes online, gets the job, sees customer details, completes stops in order', async () => {
  const bad = await call('POST', '/api/auth/login', { role: 'rider', name: 'Raju', phone: '12' });
  assert.equal(bad.status, 400);
  const rider = (await call('POST', '/api/auth/login', { role: 'rider', name: 'Raju', phone: '+91 98765 43210', vehicle: 'Bike' })).body;
  assert.equal(rider.user.role, 'rider');
  await call('POST', '/api/rider/status', { online: true, location: [16.849, 74.604] }, rider.token);

  const tok = await login('Meera', near(-0.006, -0.006));
  await call('PATCH', '/api/me', { phone: '9000012345' }, tok);
  const r = await call('POST', '/api/checkout', { tip: 10, instructions: ['Don’t ring the bell'], lines: [{ merchantId: 'fx_grocery', itemId: await firstItem(tok, 'fx_grocery'), qty: 2 }] }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const gid = r.body.groupId;
  await call('POST', `/api/groups/${gid}/lock`, null, tok);
  const p = await call('POST', '/api/payments', { groupId: gid, scope: 'mine' }, tok);
  await call('POST', `/api/payments/${p.body.id}/capture`, null, tok);

  const jobs = await waitFor(async () => { const j = (await call('GET', '/api/rider/jobs', null, rider.token)).body; return j.active?.length && j; });
  const job = jobs.active[0];
  const drop = job.stops.find((s) => s.kind === 'drop');
  assert.equal(drop.customer.name, 'Meera');
  assert.match(drop.customer.address, /Test Society/);
  assert.equal(drop.customer.phone, '9000012345');
  assert.deepEqual(drop.instructions, ['Don’t ring the bell']);
  assert.equal(drop.tip, 10);
  assert.ok(job.stops[0].orders[0].items[0].qty === 2, 'pickup shows items to collect');
  assert.ok(job.route.length > 1, 'route to drive');

  const v = (await call('GET', `/api/groups/${gid}`, null, tok)).body;
  assert.equal(v.delivery.riders[0].name, 'Raju', 'customer sees the real partner');
  const route = (await call('GET', `/api/groups/${gid}/route`, null, tok)).body;
  assert.ok(route.points.length > 1, 'customer gets a route line');

  const outOfOrder = await call('POST', `/api/rider/jobs/${job.deliveryId}/stops/1/done`, null, rider.token);
  assert.equal(outOfOrder.status, 409);
  await call('POST', `/api/rider/location`, { location: job.stops[0].location }, rider.token);
  for (let i = 0; i < job.totalStops; i++) assert.equal((await call('POST', `/api/rider/jobs/${job.deliveryId}/stops/${i}/done`, null, rider.token)).status, 200);
  const done = await waitFor(async () => { const x = (await call('GET', `/api/groups/${gid}`, null, tok)).body; return x.status === 'delivered' && x; });
  assert.equal(done.savings.status, 'confirmed');
  const other = await login('Nosy');
  assert.equal((await call('GET', '/api/rider/jobs', null, other)).status, 403, 'customers cannot see rider jobs');
});
