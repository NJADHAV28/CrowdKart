// Usage: npm run check:places -w server -- 16.8528,74.6094
// Tests every configured store provider with your keys from server/.env and prints what comes back.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.CROWDKART_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-check-'));
const arg = process.argv.find((a) => /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(a)) || '16.8528,74.6094';
const loc = arg.split(',').map(Number);
const { config } = await import('../src/config.js');
const { tomtom, ola } = await import('../src/providers.js');
const places = await import('../src/places.js');
const radiusM = (config.places.radiusKm + 1) * 1000;

const tests = [
  ['Google Places', config.places.googleKey, null],
  ['Ola Maps', config.places.olaKey, () => ola(loc, radiusM)],
  ['TomTom', config.places.tomtomKey, () => tomtom(loc, radiusM)],
];
console.log(`\nChecking store providers around ${loc.join(', ')} (radius ${config.places.radiusKm} km)\n`);
for (const [name, key, fn] of tests) {
  if (!key) { console.log(`- ${name}: no key set`); continue; }
  if (!fn) { console.log(`- ${name}: key set (checked as part of the combined run below)`); continue; }
  const t = Date.now();
  try {
    const list = await fn();
    const byCat = {};
    list.forEach((p) => (byCat[p.category] = (byCat[p.category] || 0) + 1));
    console.log(`✔ ${name}: ${list.length} places in ${Date.now() - t} ms`, byCat);
    list.slice(0, 5).forEach((p) => console.log(`    ${p.name} · ${p.category} · ${p.location.map((x) => x.toFixed(4)).join(',')}`));
  } catch (e) { console.log(`✖ ${name}: ${e.message}`); }
}
const t = Date.now();
try {
  const all = await places.fetchAllProviders(loc, radiusM);
  console.log(`\nCombined (incl. OpenStreetMap): ${all.length} raw results in ${Date.now() - t} ms`);
  console.log('Per provider:', places.lastRun);
} catch (e) { console.log('Combined run failed:', e.message); }
process.exit(0);
