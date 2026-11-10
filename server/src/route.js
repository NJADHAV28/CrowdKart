// CrowdRoute: decides how a group is delivered.
// combined  = one store, one rider           batched   = many stores, ONE rider
// coordinated = several riders, same window  separate  = single order / no real saving
import { config } from './config.js';
import { haversineKm, pathKm } from './geo.js';
import { riderTripCost, soloDeliveryFee, ROAD_FACTOR } from './pricing.js';

const D = () => config.delivery;
const RIDER_NAMES = ['Ravi', 'Sameer', 'Anil', 'Pooja', 'Imran', 'Kiran', 'Neha', 'Vikas'];

function nearestNeighbour(start, points) {
  const out = [];
  const left = [...points];
  let cur = start;
  while (left.length) {
    left.sort((a, b) => haversineKm(cur, a.location) - haversineKm(cur, b.location));
    const nxt = left.shift();
    out.push(nxt);
    cur = nxt.location;
  }
  return out;
}

/** Non-perishables first, hot food last so it arrives fresh. */
function orderPickups(merchants, toward) {
  const far = (arr) => [...arr].sort((a, b) => haversineKm(b.location, toward) - haversineKm(a.location, toward));
  const food = merchants.filter((m) => m.category === 'food');
  const rest = merchants.filter((m) => m.category !== 'food');
  const restOrdered = rest.length ? nearestNeighbour(far(rest)[0].location, rest) : [];
  const startFood = restOrdered.length ? restOrdered.at(-1).location : food.length ? far(food)[0].location : toward;
  return [...restOrdered, ...nearestNeighbour(startFood, food)];
}

const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

export function planDelivery(orders, merchantsById) {
  const byMerchant = new Map();
  for (const o of orders) {
    if (!byMerchant.has(o.merchantId)) byMerchant.set(o.merchantId, []);
    byMerchant.get(o.merchantId).push(o);
  }
  const merchants = [...byMerchant.keys()].map((mid) => merchantsById[mid]);
  const hub = centroid(orders.map((o) => o.location));

  const riders = [];
  const sorted = [...merchants].sort((a, b) => haversineKm(b.location, hub) - haversineKm(a.location, hub));
  for (const m of sorted) {
    const n = byMerchant.get(m.id).length;
    let r = riders.find((x) => x.merchants.length < D().maxPickupsPerRider && x.orderCount + n <= D().maxOrdersPerRider
      && x.merchants.every((y) => haversineKm(y.location, m.location) <= D().maxPickupSpreadKm));
    if (!r) { r = { merchants: [], orderCount: 0 }; riders.push(r); }
    r.merchants.push(m);
    r.orderCount += n;
  }

  const plannedRiders = riders.map((r, idx) => {
    const pickups = orderPickups(r.merchants, hub);
    const myOrders = r.merchants.flatMap((m) => byMerchant.get(m.id));
    const byDoor = new Map();
    for (const o of myOrders) {
      const k = o.location.map((x) => x.toFixed(5)).join(',');
      if (!byDoor.has(k)) byDoor.set(k, { location: o.location, orderIds: [] });
      byDoor.get(k).orderIds.push(o.id);
    }
    const drops = nearestNeighbour(pickups.at(-1).location, [...byDoor.values()]);
    const first = pickups[0].location;
    const start = [first[0] - 0.003, first[1] - 0.0025];
    const waypoints = [start, ...pickups.map((p) => p.location), ...drops.map((d) => d.location)];
    const routeKm = pathKm(waypoints.slice(1)) * ROAD_FACTOR;
    return {
      riderId: `rider_${idx + 1}`,
      name: RIDER_NAMES[idx % RIDER_NAMES.length],
      stops: [
        ...pickups.map((p) => ({ kind: 'pickup', merchantId: p.id, location: p.location, orderIds: byMerchant.get(p.id).map((o) => o.id) })),
        ...drops.map((d) => ({ kind: 'drop', orderId: d.orderIds[0], location: d.location, orderIds: d.orderIds })),
      ],
      start,
      waypoints,
      routeKm: Math.round(routeKm * 100) / 100,
      cost: riderTripCost(routeKm, pickups.length, drops.length),
      etaMin: Math.round(Math.max(...pickups.map((p) => p.prepMin || 10)) + (routeKm / 20) * 60 + 4),
    };
  });

  const baselineKm = orders.reduce((s, o) => s + haversineKm(merchantsById[o.merchantId].location, o.location) * 2 * ROAD_FACTOR, 0);
  const baselineCost = orders.reduce((s, o) => s + soloDeliveryFee(merchantsById[o.merchantId], o.location), 0);
  const groupCost = plannedRiders.reduce((s, r) => s + r.cost, 0);

  let type;
  if (orders.length === 1) type = 'separate';
  else if (merchants.length === 1) type = 'combined';
  else if (plannedRiders.length === 1) type = 'batched';
  else type = 'coordinated';
  if (type !== 'separate' && groupCost >= baselineCost) type = 'separate-fallback';

  const n = orders.length, m = merchants.length, rc = plannedRiders.length;
  const reason = {
    separate: 'Only your order so far, so it comes on its own.',
    combined: `All ${n} orders are from the same store, so one rider brings them together.`,
    batched: `One rider picks up from all ${m} stores and drops every order on the same trip, instead of ${n} riders.`,
    coordinated: `The stores are spread out, so ${rc} riders are timed to arrive together.`,
    'separate-fallback': 'Sharing a rider wouldn’t save money here, so each order comes on its own.',
  }[type];

  return {
    type, reason, riders: plannedRiders, ridersUsed: rc,
    ridersAvoided: type === 'separate-fallback' ? 0 : Math.max(0, n - rc),
    groupCost: type === 'separate-fallback' ? baselineCost : groupCost,
    baselineCost,
    baselineKm: Math.round(baselineKm * 100) / 100,
    groupKm: Math.round(plannedRiders.reduce((s, r) => s + r.routeKm, 0) * 100) / 100,
  };
}

/** Road geometry from OSRM, falling back to straight segments when offline. */
export async function routeGeometry(waypoints) {
  if (!config.places.fixture) {
    try {
      const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(`${config.places.osrmUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) {
        const j = await res.json();
        const line = j.routes?.[0]?.geometry?.coordinates;
        if (line?.length > 1) return { source: 'road', points: line.map(([lng, lat]) => [lat, lng]) };
      }
    } catch { /* offline */ }
  }
  const pts = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    for (let s = 0; s < 12; s++) pts.push([a[0] + ((b[0] - a[0]) * s) / 12, a[1] + ((b[1] - a[1]) * s) / 12]);
  }
  pts.push(waypoints.at(-1));
  return { source: 'straight', points: pts };
}
