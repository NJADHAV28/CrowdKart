export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371, r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export const pathKm = (pts) => pts.slice(1).reduce((s, p, i) => s + haversineKm(pts[i], p), 0);
export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Privacy grid: ~650 m cells. Activity is only ever shown per cell, never per person.
export const CELL = 0.006;
export const cellOf = ([lat, lng]) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
export const cellCenter = (key) => {
  const [a, b] = key.split(':').map(Number);
  return [(a + 0.5) * CELL, (b + 0.5) * CELL];
};
export function cellsAround([lat, lng], rings = 1) {
  const a = Math.floor(lat / CELL), b = Math.floor(lng / CELL), out = [];
  for (let i = -rings; i <= rings; i++) for (let j = -rings; j <= rings; j++) out.push(`${a + i}:${b + j}`);
  return out;
}
/** Coarsen a coordinate (~110 m) so anonymous signals never carry an exact home location. */
export const approx = ([lat, lng]) => [Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000];
export const validLoc = (l) => Array.isArray(l) && l.length === 2 && l.every((x) => Number.isFinite(Number(x))) && Math.abs(l[0]) <= 90 && Math.abs(l[1]) <= 180;
