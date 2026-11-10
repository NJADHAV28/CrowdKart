// Downloads a real photo for every catalogue product from Wikipedia / Wikimedia Commons
// into client/public/products/<slug>.jpg, and writes credits.json with the source of each image.
// Usage: node tools/fetch-product-images.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allProducts } from '../server/src/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'client/public/products');
fs.mkdirSync(outDir, { recursive: true });
const force = process.argv.includes('--force');
const UA = 'CrowdKart/1.0 (product image fetcher)';
const creditsFile = path.join(outDir, 'credits.json');
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status !== 429 && r.status < 500) return r;
    await sleep(2000 * (attempt + 1)); // rate limited: back off
  }
  return fetch(url, { headers: { 'User-Agent': UA } });
}
async function summary(title) {
  const r = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`);
  if (r.status === 404) return { missing: true };
  if (!r.ok) throw new Error(`summary ${r.status}`);
  return r.json();
}

// "commons:<search words>" picks the best photo from Wikimedia Commons search instead of a Wikipedia page.
async function commons(queries) {
  for (const q of queries.split('|')) { const hit = await commonsOne(q.trim()); if (hit) return hit; }
  return null;
}
async function commonsOne(query) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=600`;
  const r = await get(u);
  if (!r.ok) throw new Error(`commons ${r.status}`);
  const pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
  const hit = pages.find((pg) => pg.imageinfo?.[0]?.mime === 'image/jpeg' && pg.imageinfo[0].width >= 400);
  if (!hit) return null;
  return { thumbnail: { source: hit.imageinfo[0].thumburl }, content_urls: { desktop: { page: hit.imageinfo[0].descriptionurl } } };
}

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

async function one(p) {
  const file = path.join(outDir, `${p.slug}.jpg`);
  const redo = only?.includes(p.slug);
  if (only && !redo) return 'cached';
  if (!force && !redo && fs.existsSync(file) && fs.statSync(file).size > 2000) return 'cached';
  const s = p.wiki.startsWith('commons:') ? await commons(p.wiki.slice(8)) : await summary(p.wiki);
  const src = s?.thumbnail?.source || s?.originalimage?.source;
  if (!src) return s?.missing ? 'no such page' : 'no image';
  const sized = p.wiki.startsWith('commons:') ? src : src.replace(/\/(\d+)px-/, '/600px-');
  let r = await get(sized);
  if (!r.ok) r = await get(src);
  if (!r.ok) return `download ${r.status}`;
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  credits[p.slug] = { product: p.name, source: s.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${p.wiki}`, image: src, license: 'See the image page on Wikimedia Commons' };
  return 'ok';
}

const list = allProducts();
const results = {};
for (let i = 0; i < list.length; i += 2) {
  await Promise.all(list.slice(i, i + 2).map(async (p) => {
    try { results[p.slug] = await one(p); } catch (e) { results[p.slug] = `error ${e.message}`; }
  }));
  await sleep(600); // be polite to Wikipedia
}
fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
const bad = Object.entries(results).filter(([, v]) => !['ok', 'cached'].includes(v));
console.log(`${list.length} products · ${Object.values(results).filter((v) => v === 'ok').length} downloaded · ${Object.values(results).filter((v) => v === 'cached').length} cached · ${bad.length} missing`);
for (const [k, v] of bad) console.log('  missing:', k, '-', v);
