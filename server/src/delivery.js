// Rider movement along the road route: every pickup first, then each customer's door.
// (Rider position is simulated until a real rider app / partner API is connected.)
import { config } from './config.js';
import { col, id } from './store.js';
import { haversineKm } from './geo.js';
import { routeGeometry } from './route.js';

const timers = new Map();
const cumCache = new WeakMap();
const DWELL_SEC = 3;

function cumulative(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]));
  return cum;
}
const cumOf = (points) => { if (!cumCache.has(points)) cumCache.set(points, cumulative(points)); return cumCache.get(points); };

function nearestIndexFrom(points, target, from) {
  let best = from, bestD = Infinity;
  for (let i = from; i < points.length; i++) {
    const d = haversineKm(points[i], target);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
function positionAt(points, cum, km) {
  if (km <= 0) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (cum[i] >= km) {
      const f = (km - cum[i - 1]) / (cum[i] - cum[i - 1] || 1e-9);
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * f, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * f];
    }
  }
  return points.at(-1);
}

function statusText(r) {
  const pickups = r.stops.filter((s) => s.kind === 'pickup').length;
  const drops = r.totalStops - pickups;
  if (r.done) return 'All orders delivered';
  if (r.stopsDone < pickups) return r.stopsDone === 0 ? 'Heading to the first store' : `Picked up from ${r.stopsDone} of ${pickups} stores`;
  return `Delivering · ${r.stopsDone - pickups} of ${drops} dropped`;
}

const ONLINE_FRESH_MS = 10 * 60000; // a partner counts as available if their GPS updated in the last 10 min

function busy(uid) {
  return col('deliveries').find((d) => d.status === 'in_transit' && d.riders.some((r) => r.userId === uid && !r.done)).length > 0;
}

/** Nearest online, free delivery partner to the first pickup (within 15 km), or null. */
function pickPartner(near, taken) {
  const now = Date.now();
  return col('users')
    .find((u) => u.role === 'rider' && u.online && u.location && now - (u.locAt || 0) < ONLINE_FRESH_MS && !taken.has(u.id) && !busy(u.id))
    .map((u) => [u, haversineKm(u.location, near)])
    .filter(([, km]) => km <= 15)
    .sort((a, b) => a[1] - b[1])[0]?.[0] || null;
}

export async function startDelivery(group, { io, onDelivered }) {
  const riders = [];
  const taken = new Set();
  for (const r of group.plan.riders) {
    const partner = pickPartner(r.stops[0].location, taken);
    if (partner) taken.add(partner.id);
    const geo = await routeGeometry(r.waypoints);
    const cum = cumulative(geo.points);
    let idx = 0;
    const stopKm = r.stops.map((s) => { idx = nearestIndexFrom(geo.points, s.location, idx); return cum[idx]; });
    stopKm[stopKm.length - 1] = cum.at(-1);
    riders.push({
      riderId: r.riderId, name: partner ? partner.name : r.name, points: geo.points, source: geo.source, totalKm: cum.at(-1), stopKm,
      stops: r.stops.map((s) => ({ kind: s.kind, merchantId: s.merchantId, orderId: s.orderId })),
      progressKm: 0, dwell: 0, stopsDone: 0, totalStops: r.stops.length, pos: partner ? partner.location : geo.points[0], status: 'Heading to the first store', done: false,
      // live = a real delivery partner (moves with their phone's GPS, marks stops done); sim = simulated rider
      mode: partner ? 'live' : 'sim', userId: partner?.id || null,
    });
  }
  const d = col('deliveries').insert({ id: id('del'), groupId: group.id, type: group.plan.type, status: 'in_transit', startedAt: Date.now(), riders });
  runSimulation(d, io, onDelivered);
  for (const r of riders) if (r.userId) io?.to(`user:${r.userId}`).emit('job:update', { deliveryId: d.id, new: true });
  return d;
}

function runSimulation(d, io, onDelivered) {
  const stepKm = config.delivery.simSpeedKmh / 3600;
  const t = setInterval(() => {
    for (const r of d.riders) {
      if (r.done) continue;
      if (r.mode === 'live') {
        // Real partner: position comes from their phone; ETA from the road distance still to cover.
        const rest = [r.pos, ...r.stops.slice(r.stopsDone).map((_, i) => stopLoc(d, r, r.stopsDone + i)).filter(Boolean)];
        r.etaSec = Math.round((pathKmOf(rest) * 1.3) / 20 * 3600 + (r.totalStops - r.stopsDone) * 90);
        r.status = statusText(r);
        continue;
      }
      if (r.dwell > 0) { r.dwell -= 1; continue; }
      r.progressKm = Math.min(r.totalKm, r.progressKm + stepKm);
      r.pos = positionAt(r.points, cumOf(r.points), r.progressKm);
      while (r.stopsDone < r.totalStops && r.progressKm >= r.stopKm[r.stopsDone] - 1e-6) {
        const s = r.stops[r.stopsDone];
        r.stopsDone += 1;
        r.dwell = DWELL_SEC;
        if (s.kind === 'pickup') io?.to(`merchant:${s.merchantId}`).emit('merchant:update', { pickedUp: true });
        if (r.stopsDone === r.totalStops) r.done = true;
      }
      r.status = statusText(r);
      r.etaSec = Math.round((r.totalKm - r.progressKm) / stepKm + (r.totalStops - r.stopsDone) * DWELL_SEC);
    }
    io?.to(`group:${d.groupId}`).emit('rider:update', {
      groupId: d.groupId,
      riders: d.riders.map((r) => ({ riderId: r.riderId, name: r.name, pos: r.pos, status: r.status, stopsDone: r.stopsDone, totalStops: r.totalStops, etaSec: r.etaSec || 0 })),
    });
    col('deliveries').update(d.id, {});
    if (d.riders.every((r) => r.done)) {
      clearInterval(t);
      timers.delete(d.id);
      col('deliveries').update(d.id, { status: 'delivered', deliveredAt: Date.now() });
      onDelivered?.();
    }
  }, 1000);
  timers.set(d.id, t);
}

function pathKmOf(pts) { let k = 0; for (let i = 1; i < pts.length; i++) k += haversineKm(pts[i - 1], pts[i]); return k; }
function stopLoc(d, r, idx) {
  const g = col('groups').get(d.groupId);
  const planned = g?.plan?.riders?.find((x) => x.riderId === r.riderId);
  return planned?.stops?.[idx]?.location || null;
}

/** A delivery partner marks their next stop as done (picked up / delivered). */
export function completeStop(user, deliveryId, idx, io) {
  const d = col('deliveries').get(deliveryId);
  const r = d?.riders.find((x) => x.userId === user.id);
  if (!r) throw Object.assign(new Error('This delivery isn’t assigned to you'), { status: 404 });
  if (r.done) throw Object.assign(new Error('This delivery is already complete'), { status: 409 });
  if (Number(idx) !== r.stopsDone) throw Object.assign(new Error('Please complete the stops in order'), { status: 409 });
  const s = r.stops[r.stopsDone];
  r.stopsDone += 1;
  if (r.stopsDone === r.totalStops) { r.done = true; r.etaSec = 0; }
  r.status = statusText(r);
  if (s.kind === 'pickup') io?.to(`merchant:${s.merchantId}`).emit('merchant:update', { pickedUp: true });
  col('deliveries').update(d.id, {});
  io?.to(`group:${d.groupId}`).emit('group:update', { groupId: d.groupId });
  return d;
}

/** GPS from a delivery partner's phone: moves them on every map following their active jobs. */
export function updatePartnerLocation(user, loc) {
  col('users').update(user.id, { location: loc, locAt: Date.now() });
  for (const d of col('deliveries').find((x) => x.status === 'in_transit')) {
    const r = d.riders.find((x) => x.userId === user.id && !x.done);
    if (r) { r.pos = loc; col('deliveries').update(d.id, {}); }
  }
}

export function resumeDeliveries(io, onDeliveredFor) {
  for (const d of col('deliveries').find((x) => x.status === 'in_transit')) {
    if (!timers.has(d.id)) runSimulation(d, io, () => onDeliveredFor(d.groupId));
  }
}
