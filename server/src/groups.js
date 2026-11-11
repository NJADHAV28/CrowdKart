// Group lifecycle, privacy-filtered views, payments and delivery orchestration.
import crypto from 'node:crypto';
import { config, paypalEnabled, razorpayEnabled } from './config.js';
import * as razorpay from './razorpay.js';
import { col, id } from './store.js';
import { findBestGroup } from './match.js';
import { planDelivery } from './route.js';
import { computeBills } from './pricing.js';
import { approx, cellOf, cellCenter, cellsAround, haversineKm } from './geo.js';
import * as paypal from './paypal.js';
import { startDelivery } from './delivery.js';
import { routeGeometry } from './route.js';
import { getSettings, upiUri } from './settings.js';

let io = null;
export const setIO = (x) => { io = x; };

const now = () => Date.now();
const merchantsById = () => Object.fromEntries(col('merchants').all().map((m) => [m.id, m]));
export const groupOrders = (g) => g.members.map((m) => col('orders').get(m.orderId)).filter(Boolean);
export const memberOf = (g, userId) => g.members.find((m) => col('orders').get(m.orderId)?.userId === userId);
/** One person can have several shop orders in the same group (multi-shop cart). */
export const membersOf = (g, userId) => g.members.filter((m) => col('orders').get(m.orderId)?.userId === userId);
const userOf = (m) => col('orders').get(m.orderId)?.userId;

export function emitGroup(g) {
  io?.to(`group:${g.id}`).emit('group:update', { groupId: g.id, status: g.status });
  for (const mid of new Set(groupOrders(g).map((o) => o.merchantId))) io?.to(`merchant:${mid}`).emit('merchant:update');
}
const emitArea = (anchor) => io?.to(`cell:${cellOf(anchor)}`).emit('radar:update');
const emitUser = (uid, ev, payload) => io?.to(`user:${uid}`).emit(ev, payload);

// ---------- pseudonyms ----------
const ADJ = ['Mango', 'Teal', 'Saffron', 'Indigo', 'Coral', 'Mint', 'Amber', 'Jade', 'Ruby', 'Sky'];
const ANIMAL = ['Fox', 'Owl', 'Panda', 'Koala', 'Lynx', 'Otter', 'Falcon', 'Tiger', 'Heron', 'Gecko'];
function aliasFor(g) {
  const used = new Set(g.members.map((m) => m.alias));
  for (let i = 0; i < 50; i++) {
    const a = `${ADJ[crypto.randomInt(ADJ.length)]} ${ANIMAL[crypto.randomInt(ANIMAL.length)]}`;
    if (!used.has(a)) return a;
  }
  return `Neighbour ${g.members.length + 1}`;
}

// ---------- order + match ----------
const INSTRUCTION_CHOICES = ['Avoid calling', 'Don’t ring the bell', 'Leave at the door', 'Leave with security', 'Pet at home'];
function cleanInstructions(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => String(x).trim().slice(0, 140)).filter((x) => x && (INSTRUCTION_CHOICES.includes(x) || x.startsWith('Note: '))).slice(0, 6);
}

export const promoPct = (code) => (code ? config.promoCodes[String(code).trim().toUpperCase()] || 0 : 0);

export function createOrderIntent(user, { merchantId, items, windowMin = 15, preferredGroupId, promo, basketId = null, intoGroupId = null, resolved = null, tip = 0, instructions = [] }) {
  if (!user.location) throw httpError(400, 'Set your delivery location first');
  const merchant = col('merchants').get(merchantId);
  if (!merchant) throw httpError(404, 'Store not found');
  if (haversineKm(merchant.location, user.location) > config.places.radiusKm + 0.5) throw httpError(400, 'This store doesn’t deliver to your location');
  const lines = resolved || (items || []).map(({ itemId, qty }) => {
    const it = merchant.items.find((x) => x.id === itemId);
    const q = Math.max(0, Math.min(20, Math.floor(Number(qty) || 0)));
    return it && q ? { itemId, name: it.name, price: it.price, qty: q, img: it.img || null, unit: it.unit || null } : null;
  }).filter(Boolean);
  if (!lines.length) throw httpError(400, 'Your cart is empty');
  const openOrder = col('orders').findOne((o) => o.userId === user.id && o.status === 'matching' && col('groups').get(o.groupId)?.status === 'open' && !(basketId && o.basketId === basketId));
  if (openOrder) throw httpError(409, 'You already have an order waiting for neighbours. Finish or cancel it first.', { groupId: openOrder.groupId });

  const t = now();
  const win = Math.max(5, Math.min(60, Number(windowMin) || 15));
  const order = col('orders').insert({
    id: id('ord'), userId: user.id, merchantId, items: lines,
    subtotal: lines.reduce((s, l) => s + l.price * l.qty, 0),
    location: user.location, address: [user.flat, user.address].filter(Boolean).join(', '),
    windowStart: t, windowEnd: t + win * 60000, status: 'matching', createdAt: t, basketId,
    tip: Math.max(0, Math.min(200, Math.round(Number(tip) || 0))),
    instructions: cleanInstructions(instructions),
    promo: promoPct(promo) ? { code: String(promo).toUpperCase(), pct: promoPct(promo) } : null,
  });
  // Anonymous signal: coarse location only; no user id, no order id, no items.
  const signal = col('orderSignals').insert({
    id: id('sig'), approx: approx(user.location), merchantId, category: merchant.category,
    windowStart: t, windowEnd: t + win * 60000, createdAt: t, expiresAt: t + config.matching.signalTtlMin * 60000, groupId: null,
  });
  order.signalId = signal.id;

  let group, score = null, joined = false;
  const forced = intoGroupId && col('groups').get(intoGroupId);
  const { best } = forced?.status === 'open' ? { best: null } : findBestGroup(signal, preferredGroupId);
  if (forced?.status === 'open') { group = forced; joined = true; }
  else if (best) { group = best.group; score = best.score; joined = true; }
  else {
    group = col('groups').insert({
      id: id('grp'), anchor: signal.approx, area: user.area || 'Your area', status: 'open', createdAt: t,
      closesAt: t + (getSettings().waitMinutes || config.matching.groupWindowMin) * 60000, windowMin: win, members: [], plan: null, bills: null,
    });
  }
  const sameUser = group.members.find((m) => userOf(m) === user.id); // keep one nickname per person
  const member = { memberId: id('mem'), alias: sameUser ? sameUser.alias : aliasFor(group), signalId: signal.id, orderId: order.id, joinedAt: t, score, pay: 'pending' };
  group.members.push(member);
  col('groups').update(group.id, {});
  col('orders').update(order.id, { groupId: group.id, memberId: member.memberId });
  col('orderSignals').update(signal.id, { groupId: group.id });

  emitGroup(group);
  emitArea(group.anchor);
  if (group.members.length >= config.matching.minK) {
    io?.to(`cell:${cellOf(group.anchor)}`).emit('opportunity', { groupId: group.id, participants: group.members.length, closesAt: group.closesAt });
  }
  return { orderId: order.id, groupId: group.id, joinedExisting: joined, score, alias: member.alias };
}

function computePlanAndBills(g) {
  const orders = groupOrders(g);
  const ms = merchantsById();
  const plan = planDelivery(orders, ms);
  const billing = computeBills({ orders, merchants: ms, groupDeliveryCost: plan.groupCost });
  const bills = {};
  for (const m of g.members) bills[m.memberId] = billing.bills.find((b) => b.orderId === m.orderId);
  return { plan, bills, allocation: billing.allocation, totals: billing.totals };
}

export function lockGroup(g) {
  if (g.status !== 'open') return g;
  if (!g.members.length) { col('groups').update(g.id, { status: 'cancelled' }); return g; }
  const r = computePlanAndBills(g);
  col('groups').update(g.id, { status: 'awaiting_payment', lockedAt: now(), ...r });
  for (const o of groupOrders(g)) col('orders').update(o.id, { status: 'awaiting_payment' });
  col('savings').remove((s) => s.groupId === g.id);
  col('savings').insert({ id: id('sav'), groupId: g.id, status: 'estimated', ...r.totals, ridersAvoided: r.plan.ridersAvoided, createdAt: now() });
  emitGroup(g);
  emitArea(g.anchor);
  return g;
}

export function leaveGroup(g, user) {
  const mine = membersOf(g, user.id);
  if (!mine.length) throw httpError(403, 'Not part of this order');
  if (!['open', 'awaiting_payment'].includes(g.status)) throw httpError(409, 'This order is already paid');
  if (g.members.some((m) => m.pay !== 'pending')) throw httpError(409, 'Someone has already paid, so the order can’t be changed now');
  g.members = g.members.filter((m) => !mine.includes(m));
  for (const me of mine) {
    col('orders').update(me.orderId, { status: 'cancelled' });
    col('orderSignals').remove((s) => s.id === me.signalId);
  }
  if (!g.members.length) col('groups').update(g.id, { status: 'cancelled' });
  else if (g.status === 'awaiting_payment') col('groups').update(g.id, computePlanAndBills(g));
  else col('groups').update(g.id, {});
  emitGroup(g);
  emitArea(g.anchor);
}

// ---------- payments ----------
// scope 'mine'  = pay my own share
// scope 'group' = pay for everyone who hasn't paid yet
export async function createPayment(g, user, scope, method = 'razorpay') {
  const mine = membersOf(g, user.id);
  const me = mine[0];
  if (!me) throw httpError(403, 'Not part of this order');
  if (g.status !== 'awaiting_payment') throw httpError(409, 'This order isn’t ready for payment yet');
  if (scope !== 'mine') throw httpError(400, 'Each person pays for their own order');
  const pending = g.members.filter((m) => m.pay === 'pending');
  const myPending = mine.filter((m) => m.pay === 'pending');
  if (scope === 'mine' && !myPending.length) throw httpError(409, 'You’ve already paid');
  const covers = scope === 'group' ? pending.map((m) => m.memberId) : myPending.map((m) => m.memberId);
  if (!covers.length) throw httpError(409, 'Nothing left to pay');
  const amount = covers.reduce((s, mid) => s + g.bills[mid].total, 0);
  if (method === 'upi') {
    const open = col('payments').findOne((x) => x.provider === 'upi' && x.groupId === g.id && x.userId === user.id && x.status === 'created' && x.amountInr === amount);
    if (open) return publicPayment(open);
  }

  const pay = {
    id: id('pay'), groupId: g.id, payerMemberId: me.memberId, userId: user.id, scope, covers,
    amountInr: amount, provider: method === 'upi' ? 'upi' : pickProvider(method), status: 'created', createdAt: now(),
  };
  if (pay.provider === 'upi') {
    // Direct UPI to the admin's UPI ID: opens the customer's UPI app; confirmed by the admin via the UTR.
    if (!getSettings().upiId) throw httpError(400, 'UPI payments aren’t set up yet');
    const ref = pay.id.slice(4, 12).toUpperCase();
    pay.upiRef = ref;
    pay.upiUri = upiUri({ amountInr: amount, ref });
  }
  pay.currency = pay.provider === 'paypal' ? config.paypal.currency : 'INR';
  pay.chargeAmount = pay.provider === 'paypal' ? paypal.toChargeAmount(amount) : amount.toFixed(2);
  if (pay.provider === 'razorpay') {
    const o = await razorpay.createOrder({ amountInr: amount, receipt: pay.id, notes: { orders: String(covers.length) } });
    pay.razorpayOrderId = o.id;
  }
  if (pay.provider === 'paypal') {
    const ppo = await paypal.createOrder({ amountInr: amount, referenceId: pay.id, description: `CrowdKart order (${covers.length} ${covers.length > 1 ? 'orders' : 'order'})` });
    pay.paypalOrderId = ppo.id;
  }
  col('payments').insert(pay);
  return publicPayment(pay);
}
function pickProvider(method) {
  if (method === 'paypal' && paypalEnabled()) return 'paypal';
  if (razorpayEnabled()) return 'razorpay';
  if (paypalEnabled()) return 'paypal';
  return 'test'; // no payment keys configured: no money moves
}
const publicPayment = (p) => ({
  id: p.id, provider: p.provider, status: p.status, amountInr: p.amountInr, scope: p.scope, covers: p.covers.length,
  paypalOrderId: p.paypalOrderId, razorpayOrderId: p.razorpayOrderId, razorpayKeyId: p.provider === 'razorpay' ? config.razorpay.keyId : undefined,
  upiUri: p.upiUri, upiRef: p.upiRef, upiId: p.provider === 'upi' ? getSettings().upiId : undefined, payeeName: p.provider === 'upi' ? getSettings().payeeName : undefined,
});

export async function capturePayment(user, paymentId, proof = {}) {
  const p = col('payments').get(paymentId);
  if (!p || p.userId !== user.id) throw httpError(404, 'Payment not found');
  if (p.status === 'captured') return publicPayment(p);
  if (p.provider === 'upi') throw httpError(403, 'UPI payments are confirmed by the admin after checking the transaction');
  if (p.provider === 'razorpay') {
    const ok = razorpay.verifyPayment({ orderId: p.razorpayOrderId, paymentId: proof.razorpay_payment_id, signature: proof.razorpay_signature });
    if (!ok || proof.razorpay_order_id !== p.razorpayOrderId) throw httpError(400, 'We couldn’t verify this payment. If money was deducted it will be refunded automatically.');
    p.razorpayPaymentId = proof.razorpay_payment_id;
  }
  if (p.provider === 'paypal') {
    const cap = await paypal.captureOrder(p.paypalOrderId);
    if (cap.status !== 'COMPLETED') throw httpError(402, 'Payment was not completed');
    p.captureId = cap.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  }
  markCaptured(p);
  return publicPayment(p);
}

/** Customer says they've paid by UPI: store the 12-digit UTR for the admin to verify. */
export function submitUpi(user, paymentId, utr) {
  const p = col('payments').get(paymentId);
  if (!p || p.userId !== user.id || p.provider !== 'upi') throw httpError(404, 'Payment not found');
  if (p.status === 'captured') return publicPayment(p);
  const clean = String(utr || '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(clean)) throw httpError(400, 'Enter the 12-digit UPI transaction ID (UTR) from your UPI app');
  if (col('payments').findOne((x) => x.utr === clean && x.id !== p.id)) throw httpError(409, 'This transaction ID was already used');
  col('payments').update(p.id, { status: 'submitted', utr: clean, submittedAt: now() });
  const g = col('groups').get(p.groupId);
  if (g) emitGroup(g);
  io?.emit('admin:update');
  return publicPayment(col('payments').get(p.id));
}

export function markCaptured(p) {
  if (p.status === 'captured') return;
  col('payments').update(p.id, { status: 'captured', capturedAt: now(), captureId: p.captureId });
  const g = col('groups').get(p.groupId);
  if (p.scope === 'group' && !g.paidBy) g.paidBy = p.payerMemberId;
  for (const m of g.members) {
    if (p.covers.includes(m.memberId) && m.pay === 'pending') {
      m.pay = userOf(m) === p.userId ? 'paid' : 'covered';
      col('orders').update(m.orderId, { status: 'paid' });
      const o = col('orders').get(m.orderId);
      if (m.pay === 'covered') emitUser(o.userId, 'toast', { text: 'A neighbour paid for the whole group, so your order is covered.' });
    }
  }
  col('groups').update(g.id, {});
  if (g.members.every((m) => m.pay !== 'pending')) {
    col('groups').update(g.id, { status: 'paid', paidAt: now() });
    dispatch(g);
  }
  emitGroup(g);
}

async function dispatch(g) {
  col('groups').update(g.id, { status: 'in_transit', dispatchedAt: now() });
  for (const o of groupOrders(g)) col('orders').update(o.id, { status: 'in_transit' });
  emitGroup(g);
  await startDelivery(g, { io, onDelivered: () => onDelivered(g) });
}

export const onDeliveredById = (gid) => onDelivered(col('groups').get(gid));
function onDelivered(g) {
  col('groups').update(g.id, { status: 'delivered', deliveredAt: now() });
  for (const o of groupOrders(g)) col('orders').update(o.id, { status: 'delivered' });
  const s = col('savings').findOne((x) => x.groupId === g.id);
  if (s) col('savings').update(s.id, { status: 'confirmed', confirmedAt: now() });
  const sigs = new Set(g.members.map((m) => m.signalId));
  col('orderSignals').remove((x) => sigs.has(x.id));
  emitGroup(g);
  emitArea(g.anchor);
}

// ---------- views (privacy boundary) ----------
export function groupView(g, user) {
  const mine = membersOf(g, user.id);
  if (!mine.length) throw httpError(403, 'You are not part of this order');
  const ms = merchantsById();
  const live = g.status === 'open' ? computePlanAndBills(g) : { plan: g.plan, bills: g.bills, allocation: g.allocation, totals: g.totals };
  const plan = live.plan;
  const sav = col('savings').findOne((s) => s.groupId === g.id);
  const delivery = col('deliveries').findOne((d) => d.groupId === g.id);
  const myOrders = mine.map((m) => col('orders').get(m.orderId));
  const myIds = new Set(myOrders.map((o) => o.id));
  const bills = mine.map((m) => live.bills[m.memberId]).filter(Boolean);
  const sum = (k) => bills.reduce((s, b) => s + (b[k] || 0), 0);
  const bill = {
    subtotal: sum('subtotal'), discount: sum('discount'), deliveryShare: sum('deliveryShare'), soloDeliveryFee: sum('soloDeliveryFee'),
    total: sum('total'), soloTotal: sum('soloTotal'), saving: sum('saving'), tip: sum('tip'),
    discountPct: Math.max(0, ...bills.map((b) => b.discountPct || 0)), promoPct: bills[0]?.promoPct || 0, promoCode: bills[0]?.promoCode || null,
  };
  const myRider = plan.riders.find((r) => r.stops.some((s) => s.orderIds.some((oid) => myIds.has(oid))));
  const lastIdx = (stops, pred) => stops.reduce((acc, s, i) => (pred(s) ? i : acc), -1);
  const users = [...new Set(g.members.map(userOf))];
  const userPaid = (uid) => g.members.filter((m) => userOf(m) === uid).every((m) => m.pay !== 'pending');
  const pending = g.members.filter((m) => m.pay === 'pending');
  const myPay = mine.every((m) => m.pay === 'covered') ? 'covered' : mine.every((m) => m.pay !== 'pending') ? 'paid' : 'pending';
  const orderView = (o) => {
    const st = ms[o.merchantId];
    return { id: o.id, items: o.items, subtotal: o.subtotal, location: o.location, address: o.address, store: { id: st.id, name: st.name, category: st.category, kind: st.kind, location: st.location } };
  };
  const aliases = new Map();
  for (const m of g.members) if (!aliases.has(m.alias)) aliases.set(m.alias, { alias: m.alias, isMe: userOf(m) === user.id });

  return {
    id: g.id,
    area: g.area,
    status: g.status,
    createdAt: g.createdAt,
    closesAt: g.closesAt,
    participants: users.length,
    members: [...aliases.values()],
    paidCount: users.filter(userPaid).length,
    pendingTotal: g.status === 'awaiting_payment' ? pending.reduce((s, m) => s + live.bills[m.memberId].total, 0) : null,
    paidByMe: Boolean(g.paidBy && mine.some((m) => m.memberId === g.paidBy)),
    upi: (() => {
      const mineIds = new Set(mine.map((m) => m.memberId));
      const p = col('payments').find((x) => x.groupId === g.id && x.provider === 'upi' && x.covers.some((c) => mineIds.has(c))).sort((x, y) => y.createdAt - x.createdAt)[0];
      return p ? { id: p.id, status: p.status, utr: p.utr || null, note: p.adminNote || null } : null;
    })(),
    me: {
      alias: mine[0].alias,
      pay: myPay,
      score: mine[0].score,
      orders: myOrders.map(orderView),
      order: orderView(myOrders[0]),
      bill,
    },
    estimate: g.status === 'open',
    savings: { status: sav?.status || 'estimated', baselineDelivery: live.totals.baselineDelivery, groupDelivery: live.totals.groupDelivery, deliverySaved: live.totals.deliverySaved },
    plan: plan && {
      type: plan.type, reason: plan.reason, ridersUsed: plan.ridersUsed, ridersAvoided: plan.ridersAvoided,
      stores: new Set(plan.riders.flatMap((r) => r.stops.filter((s) => s.kind === 'pickup').map((s) => s.merchantId))).size,
    },
    myRider: myRider && {
      riderId: myRider.riderId, name: myRider.name,
      myPickupIndex: lastIdx(myRider.stops, (s) => s.kind === 'pickup' && s.orderIds.some((oid) => myIds.has(oid))),
      myDropIndex: lastIdx(myRider.stops, (s) => s.kind === 'drop' && s.orderIds.some((oid) => myIds.has(oid))),
      totalStops: myRider.stops.length,
      pickups: myRider.stops.filter((s) => s.kind === 'pickup').length,
    },
    delivery: delivery && {
      status: delivery.status,
      riders: delivery.riders.map((r) => ({ riderId: r.riderId, name: r.name, pos: r.pos, status: r.status, stopsDone: r.stopsDone, totalStops: r.totalStops, etaSec: r.etaSec })),
    },
  };
}

const bucket = (n) => (n < config.matching.minK ? null : n <= 3 ? '2-3' : n <= 6 ? '4-6' : '7+');

export function radarView(user) {
  const t = now();
  const sigs = col('orderSignals').find((s) => s.expiresAt > t);
  const counts = {};
  for (const s of sigs) { const k = cellOf(s.approx); counts[k] = (counts[k] || 0) + 1; }
  const myCell = cellOf(user.location);
  const cells = cellsAround(user.location, 2)
    .map((k) => ({ key: k, center: cellCenter(k), activity: bucket(counts[k] || 0), mine: k === myCell }))
    .filter((c) => c.activity);
  const nearby = sigs.filter((s) => haversineKm(s.approx, user.location) <= config.matching.dropRadiusKm).length;
  const opportunities = col('groups')
    .find((g) => g.status === 'open' && g.closesAt > t && g.members.length >= config.matching.minK && !memberOf(g, user.id)
      && haversineKm(g.anchor, user.location) <= config.matching.dropRadiusKm)
    .map((g) => ({ groupId: g.id, participants: g.members.length, closesAt: g.closesAt }));
  const mine = col('groups')
    .find((g) => ['open', 'awaiting_payment', 'paid', 'in_transit'].includes(g.status) && memberOf(g, user.id))
    .map((g) => ({ groupId: g.id, status: g.status, participants: g.members.length, closesAt: g.closesAt }));
  return { cells, nearby: bucket(nearby), opportunities, mine };
}

export function merchantDashboard(user) {
  const mid = user.merchantId;
  const ms = merchantsById();
  const me = ms[mid];
  const t = now();
  const groups = col('groups').find((g) => g.status !== 'cancelled' && groupOrders(g).some((o) => o.merchantId === mid));
  const groupOrdersOut = groups.sort((a, b) => b.createdAt - a.createdAt).map((g) => {
    const live = g.status === 'open' ? computePlanAndBills(g) : { plan: g.plan, bills: g.bills };
    const rider = live.plan.riders.find((r) => r.stops.some((s) => s.merchantId === mid));
    return {
      groupId: g.id, status: g.status, createdAt: g.createdAt, area: g.area,
      deliveryType: live.plan.type, riderName: rider?.name, riderPickups: rider?.stops.filter((s) => s.kind === 'pickup').length,
      orders: g.members.filter((m) => col('orders').get(m.orderId)?.merchantId === mid).map((m) => {
        const o = col('orders').get(m.orderId);
        const b = live.bills[m.memberId];
        return { ref: m.alias, items: o.items, subtotal: o.subtotal, discount: b?.discount || 0, paid: m.pay !== 'pending', instructions: o.instructions || [] };
      }),
    };
  });
  const sigs = col('orderSignals').find((s) => s.expiresAt > t);
  const rings = [[0, 1, 'Within 1 km'], [1, 2, '1–2 km away'], [2, 3, '2–3 km away']].map(([a, b, label]) => {
    const inRing = sigs.filter((s) => { const d = haversineKm(s.approx, me.location); return d >= a && d < b; });
    return { label, all: bucket(inRing.length), category: bucket(inRing.filter((s) => s.category === me.category).length) };
  });
  const paid = groupOrdersOut.filter((g) => ['paid', 'in_transit', 'delivered'].includes(g.status));
  return {
    merchant: me, groupOrders: groupOrdersOut, demand: rings,
    stats: {
      groupOrders: groupOrdersOut.length,
      ordersReceived: groupOrdersOut.reduce((s, g) => s + g.orders.length, 0),
      revenue: paid.reduce((s, g) => s + g.orders.reduce((a, o) => a + o.subtotal - o.discount, 0), 0),
      discountsGiven: paid.reduce((s, g) => s + g.orders.reduce((a, o) => a + o.discount, 0), 0),
    },
  };
}

export function updateMenu(user, items) {
  const m = col('merchants').get(user.merchantId);
  if (!m) throw httpError(404, 'Store not found');
  const okImg = (u) => (typeof u === 'string' && (/^products\/[a-z0-9-]+\.jpg$/.test(u) || /^img\/off\/[0-9/]+\/[a-z0-9_.]+\.jpg$/i.test(u) || /^https:\/\/[^\s"'<>]{8,300}$/.test(u)) ? u : null);
  const clean = (Array.isArray(items) ? items : []).slice(0, 150).map((it, i) => ({
    id: String(it.id || `m${Date.now().toString(36)}${i}`).slice(0, 40),
    name: String(it.name || '').trim().slice(0, 60),
    price: Math.round(Number(it.price)),
    unit: String(it.unit || '').trim().slice(0, 20) || null,
    tag: String(it.tag || '').trim().slice(0, 24) || 'Other',
    desc: String(it.desc || '').trim().slice(0, 240) || null,
    img: okImg(it.img),
  })).filter((it) => it.name && it.price > 0 && it.price < 100000);
  if (!clean.length) throw httpError(400, 'Add at least one item with a price');
  return col('merchants').update(m.id, { items: clean, menuSource: 'merchant' });
}

export function myOrders(user) {
  const ms = merchantsById();
  return col('orders').find((o) => o.userId === user.id).sort((a, b) => b.createdAt - a.createdAt).map((o) => {
    const g = o.groupId && col('groups').get(o.groupId);
    const m = ms[o.merchantId];
    return {
      id: o.id, groupId: o.groupId, status: o.status, createdAt: o.createdAt, subtotal: o.subtotal, items: o.items,
      store: { id: o.merchantId, name: m?.name, category: m?.category, kind: m?.kind },
      participants: g?.members.length || 1, deliveryType: g?.plan?.type,
      bill: g?.bills?.[o.memberId] || null,
    };
  });
}

// ---------- delivery partner jobs (rider app) ----------
// A partner sees exactly what they need to fulfil the job: shop + items to collect, and the
// customer's name, flat/address, phone (if given) and delivery instructions.
export function riderJobs(user) {
  const ms = merchantsById();
  const ds = col('deliveries').find((d) => d.riders.some((r) => r.userId === user.id)).sort((a, b) => b.startedAt - a.startedAt).slice(0, 25);
  const jobs = ds.map((d) => {
    const g = col('groups').get(d.groupId);
    const r = d.riders.find((x) => x.userId === user.id);
    const planned = g?.plan?.riders?.find((x) => x.riderId === r.riderId);
    if (!planned) return null;
    const ref = (oid) => oid.slice(4, 12).toUpperCase();
    const stops = planned.stops.map((s, i) => {
      const done = i < r.stopsDone;
      if (s.kind === 'pickup') {
        const m = ms[s.merchantId] || {};
        return {
          kind: 'pickup', idx: i, done, location: s.location,
          store: { name: m.name, address: m.address || '', phone: m.phone || null },
          orders: s.orderIds.map((oid) => { const o = col('orders').get(oid); return { ref: ref(oid), items: (o?.items || []).map((it) => ({ name: it.name, qty: it.qty, unit: it.unit || null })) }; }),
        };
      }
      const os = (s.orderIds || [s.orderId]).map((oid) => col('orders').get(oid)).filter(Boolean);
      const o = os[0];
      const cu = o && col('users').get(o.userId);
      return {
        kind: 'drop', idx: i, done, location: s.location, ref: os.map((x) => ref(x.id)).join(', '),
        customer: { name: cu?.name || 'Customer', flat: cu?.flat || '', address: o?.address || cu?.address || '', phone: cu?.phone || null },
        instructions: [...new Set(os.flatMap((x) => x.instructions || []))],
        tip: os.reduce((t, x) => t + (x.tip || 0), 0),
        items: os.reduce((n, x) => n + x.items.reduce((m, it) => m + it.qty, 0), 0),
        shops: os.length,
        paid: true,
      };
    });
    const tips = stops.filter((s) => s.kind === 'drop').reduce((t, s) => t + s.tip, 0);
    return {
      deliveryId: d.id, groupId: d.groupId, status: r.done ? 'delivered' : d.status, startedAt: d.startedAt, deliveredAt: d.deliveredAt || null,
      stopsDone: r.stopsDone, totalStops: r.totalStops, route: r.points, pos: r.pos, etaSec: r.etaSec || 0, routeKm: planned.routeKm,
      earnings: { trip: planned.cost, tips, total: planned.cost + tips },
      stops,
    };
  }).filter(Boolean);
  return {
    active: jobs.filter((j) => j.status !== 'delivered'),
    history: jobs.filter((j) => j.status === 'delivered'),
    today: jobs.filter((j) => j.status === 'delivered' && Date.now() - (j.deliveredAt || j.startedAt) < 24 * 3600e3).reduce((t, j) => t + j.earnings.total, 0),
  };
}

// ---------- road route for a customer's tracking map ----------
// Only the leg from the rider to THIS customer's next point (their shop, then their door),
// so other neighbours' stops are never revealed.
const routeCache = new Map();
export async function customerRoute(g, user) {
  const mine = membersOf(g, user.id);
  if (!mine.length) throw httpError(403, 'You are not part of this order');
  const d = col('deliveries').findOne((x) => x.groupId === g.id);
  if (!d || g.status !== 'in_transit') return { points: [] };
  const myIds = new Set(mine.map((m) => m.orderId));
  const planned = g.plan.riders.find((r) => r.stops.some((s) => s.orderIds.some((oid) => myIds.has(oid))));
  const r = planned && d.riders.find((x) => x.riderId === planned.riderId);
  if (!r?.pos) return { points: [] };
  const lastIdx = (pred) => planned.stops.reduce((acc, s, i) => (pred(s) ? i : acc), -1);
  const pickupIdx = lastIdx((s) => s.kind === 'pickup' && s.orderIds.some((oid) => myIds.has(oid)));
  const dropIdx = lastIdx((s) => s.kind === 'drop' && s.orderIds.some((oid) => myIds.has(oid)));
  const target = r.stopsDone <= pickupIdx ? planned.stops[pickupIdx].location : planned.stops[dropIdx]?.location;
  if (!target || r.stopsDone > dropIdx) return { points: [] };
  const key = `${r.pos.map((x) => x.toFixed(3)).join(',')}>${target.map((x) => x.toFixed(4)).join(',')}`;
  if (!routeCache.has(key)) {
    const geo = await routeGeometry([r.pos, target]);
    routeCache.set(key, { points: geo.points, road: geo.source === 'road', target, toStore: r.stopsDone <= pickupIdx });
    if (routeCache.size > 500) routeCache.delete(routeCache.keys().next().value);
  }
  return routeCache.get(key);
}

export function tick() {
  const t = now();
  for (const g of col('groups').find((x) => x.status === 'open' && x.closesAt <= t)) lockGroup(g);
  col('orderSignals').remove((s) => s.expiresAt <= t && !['open', 'awaiting_payment', 'paid', 'in_transit'].includes(col('groups').get(s.groupId)?.status));
}

export function httpError(status, message, extra) {
  return Object.assign(new Error(message), { status, extra });
}
