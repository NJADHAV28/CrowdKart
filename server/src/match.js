// Match engine: hard eligibility rules + weighted compatibility score
// S = 0.25L + 0.20T + 0.25M + 0.15D + 0.15E, computed only on anonymous signals
// (coarse location, store id, category, time window). No names, carts or exact homes.
import { config } from './config.js';
import { col } from './store.js';
import { clamp, haversineKm } from './geo.js';
import { soloDeliveryFee, riderTripCost, ROAD_FACTOR } from './pricing.js';

export const WEIGHTS = { L: 0.25, T: 0.2, M: 0.25, D: 0.15, E: 0.15 };
const merchantOf = (mid) => col('merchants').get(mid);

export function scorePair(a, b) {
  const ma = merchantOf(a.merchantId), mb = merchantOf(b.merchantId);
  const dropKm = haversineKm(a.approx, b.approx);
  const L = dropKm <= 0.15 ? 100 : clamp(100 - ((dropKm - 0.15) / 0.85) * 100);
  const dtMin = Math.abs(a.windowStart - b.windowStart) / 60000;
  const T = dtMin <= 5 ? 100 : clamp(100 - ((dtMin - 5) / 25) * 100);
  const merchKm = haversineKm(ma.location, mb.location);
  let M;
  if (a.merchantId === b.merchantId) M = 100;
  else if (a.category === b.category && merchKm <= 1.5) M = 75;
  else if (merchKm <= 1.5) M = 60;
  else if (merchKm <= config.delivery.maxPickupSpreadKm) M = 40;
  else M = 0;
  const D = clamp(100 - dropKm * 120);
  const solo = soloDeliveryFee(ma, a.approx) + soloDeliveryFee(mb, b.approx);
  const pickupKm = a.merchantId === b.merchantId ? 0 : merchKm;
  const routeKm = (pickupKm + haversineKm(mb.location, a.approx) + dropKm) * ROAD_FACTOR;
  const combined = riderTripCost(routeKm, a.merchantId === b.merchantId ? 1 : 2, dropKm > 0.05 ? 2 : 1);
  const E = clamp(Math.max(0, (solo - combined) / solo) * 200);
  const S = WEIGHTS.L * L + WEIGHTS.T * T + WEIGHTS.M * M + WEIGHTS.D * D + WEIGHTS.E * E;
  const r = (x) => Math.round(x * 10) / 10;
  return { L: r(L), T: r(T), M: r(M), D: r(D), E: r(E), S: r(S) };
}

export function eligible(group, signal, now = Date.now()) {
  if (group.status !== 'open') return 'group is no longer open';
  if (now > group.closesAt) return 'group has closed';
  if (group.members.length >= config.matching.maxMembers) return 'group is full';
  if (haversineKm(group.anchor, signal.approx) > config.matching.dropRadiusKm) return 'too far from the group';
  const m = merchantOf(signal.merchantId);
  if (!m?.acceptsGroupOrders) return 'store does not accept group orders';
  const sigs = group.members.map((x) => col('orderSignals').get(x.signalId)).filter(Boolean);
  const farthest = Math.max(0, ...sigs.map((s) => haversineKm(merchantOf(s.merchantId).location, m.location)));
  if (farthest > config.delivery.maxPickupSpreadKm) return 'stores too far apart for one rider';
  return null;
}

export function scoreAgainstGroup(group, signal) {
  const others = group.members.map((x) => col('orderSignals').get(x.signalId)).filter(Boolean);
  if (!others.length) return null;
  const pairs = others.map((o) => scorePair(signal, o));
  const avg = (k) => Math.round((pairs.reduce((s, p) => s + p[k], 0) / pairs.length) * 10) / 10;
  return { L: avg('L'), T: avg('T'), M: avg('M'), D: avg('D'), E: avg('E'), S: avg('S') };
}

export function findBestGroup(signal, preferredGroupId) {
  const candidates = col('groups').find((g) => g.status === 'open' && haversineKm(g.anchor, signal.approx) <= config.matching.dropRadiusKm);
  let best = null;
  for (const g of candidates) {
    if (eligible(g, signal)) continue;
    const score = scoreAgainstGroup(g, signal);
    if (!score) continue;
    const rank = score.S + (g.id === preferredGroupId ? 5 : 0);
    if (score.S >= config.matching.threshold && (!best || rank > best.rank)) best = { group: g, score, rank };
  }
  return { best };
}
