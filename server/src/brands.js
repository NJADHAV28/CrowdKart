// Branded packaged products (Lay's, Maggi, Amul…) from Open Food Facts: free, no API key.
// https://world.openfoodfacts.org · data under the Open Database License, images CC BY-SA.
// Open Food Facts has no prices, so we use the MRP printed in the product name when present
// ("Lays Classic Salted 20rs"), otherwise an estimate from pack size and product type.
import { config } from './config.js';
import { col } from './store.js';
import { haversineKm } from './geo.js';

const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,brands,quantity,image_front_small_url,image_front_url,categories_tags';
const searchCache = new Map(); // query -> { at, list }
const recentSearches = []; // timestamps, Open Food Facts allows ~10 searches/minute

async function getJson(url, ms = 15000) {
  // Open Food Facts is a volunteer-run service and sometimes answers 503 when busy: retry briefly.
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': `${config.places.userAgent} product search` }, signal: ctl.signal });
      if (r.ok) return await r.json();
      last = new Error(`Open Food Facts ${r.status}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) { last = e; } finally { clearTimeout(t); }
    await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
  }
  throw last;
}

/** Backup: the newer Open Food Facts search service (India first, then worldwide). */
async function searchBackup(q) {
  const base = `https://search.openfoodfacts.org/search?page_size=30&fields=${FIELDS},countries_tags&q=`;
  let j = await getJson(base + encodeURIComponent(`${q} countries_tags:"en:india"`));
  if (!j.hits?.length) j = await getJson(base + encodeURIComponent(q));
  return (j.hits || []).map((h) => ({ ...h, brands: Array.isArray(h.brands) ? h.brands.join(', ') : h.brands }));
}

// ₹ per 100 g / 100 ml, by Open Food Facts category (rough Indian MRP levels)
const RATES = [
  [/buttermilk|butter-milk|chaas|lassi|flavoured-milk|milk-drink/, 6],
  [/chips|crisps|salty-snacks|namkeen|extruded/, 40], [/chocolate|confectioner|candies/, 110], [/biscuit|cookie|cracker|wafer/, 18],
  [/instant-noodle|noodle|pasta/, 22], [/breakfast-cereal|muesli|oat/, 45], [/coffee/, 250], [/tea/, 50],
  [/cheese/, 60], [/butter|ghee/, 55], [/ice-cream/, 35], [/milk|dairy|yogurt|curd/, 7], [/juice|soda|soft-drink|beverage|water|drink/, 9],
  [/sauce|ketchup|spread|jam/, 30], [/flour|atta|rice|sugar|salt|pulse|lentil|dal/, 8], [/oil/, 17],
];

export function estimatePrice(p) {
  const name = `${p.product_name || ''} ${p.product_name_en || ''}`;
  const mrp = name.match(/(?:₹|rs\.?|inr)\s*(\d{1,4})|(\d{1,4})\s*(?:₹|rs\b|\/-|rupees)/i);
  if (mrp) { const v = Number(mrp[1] || mrp[2]); if (v >= 5 && v <= 5000) return { price: v, exact: true }; }
  const q = String(p.quantity || '').toLowerCase().match(/([\d.]+)\s*(kg|g|gm|gms|grams?|l|ltr|litres?|ml)\b/);
  let amount = 100;
  if (q) amount = Number(q[1]) * (/^(kg|l|ltr|litre|litres)$/.test(q[2]) ? 1000 : 1);
  const cats = (p.categories_tags || []).join(' ');
  const rate = (RATES.find(([re]) => re.test(cats) || re.test(name.toLowerCase())) || [null, 45])[1];
  const price = Math.max(10, Math.round(((amount / 100) * rate) / 5) * 5);
  return { price, exact: false };
}

function toProduct(p) {
  const name = (p.product_name_en || p.product_name || '').trim();
  const img = p.image_front_small_url || p.image_front_url;
  if (!p.code || !name || !img) return null;
  const brand = (p.brands || '').split(',')[0].trim();
  const { price, exact } = estimatePrice(p);
  return {
    id: `off:${p.code}`, code: p.code, name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name,
    // Served through our own cached proxy (see /img/off in index.js): fast, and works offline once seen.
    brand, unit: p.quantity || null, img: `img/off/${img.replace(/^https:\/\/images\.openfoodfacts\.org\/images\/products\//, '').replace(/\.(100|200)\.jpg$/, '.400.jpg')}`, price, priceExact: exact,
    tag: 'Packaged', desc: `${brand ? `${brand} · ` : ''}${p.quantity || ''}. Product data from Open Food Facts.`.trim(),
  };
}

export async function searchBrands(q) {
  q = String(q || '').trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return [];
  const hit = searchCache.get(q);
  if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.list;
  const now = Date.now();
  while (recentSearches.length && now - recentSearches[0] > 60000) recentSearches.shift();
  if (recentSearches.length >= 9) throw Object.assign(new Error('Too many searches right now. Please try again in a minute.'), { status: 429 });
  recentSearches.push(now);
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&countries_tags_en=india&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`;
  let raw;
  try {
    raw = (await getJson(url)).products || [];
  } catch (e) {
    console.warn('[brands] main search failed, using backup:', e.message);
    try { raw = await searchBackup(q); } catch {
      throw Object.assign(new Error('Product search is busy right now. Please try again in a moment.'), { status: 503 });
    }
  }
  const seen = new Set();
  const list = raw.map(toProduct).filter((p) => p && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()));
  for (const p of list) if (!col('brandProducts').get(p.id)) col('brandProducts').insert({ ...p, savedAt: Date.now() });
  searchCache.set(q, { at: Date.now(), list });
  return list;
}

/** Server-side source of truth for a brand product (never trust prices sent by the app). */
export async function getBrand(id) {
  const saved = col('brandProducts').get(id);
  if (saved) return saved;
  const code = String(id).replace(/^off:/, '');
  if (!/^\d{6,14}$/.test(code)) return null;
  const j = await getJson(`${OFF}/api/v2/product/${code}?fields=${FIELDS}`);
  const p = j.product && toProduct({ ...j.product, code });
  if (p) col('brandProducts').insert({ ...p, savedAt: Date.now() });
  return p;
}

/** The nearest grocery / kirana shop that delivers to this location, for packaged products. */
export function nearestShopFor(loc, stores) {
  const ranked = stores
    .filter((m) => m.category === 'grocery' && m.items?.length)
    .map((m) => [m, haversineKm(loc, m.location)])
    .sort((a, b) => (a[0].openNow === false) - (b[0].openNow === false) || a[1] - b[1]);
  return ranked[0]?.[0] || null;
}
