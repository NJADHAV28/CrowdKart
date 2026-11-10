// Address search + reverse geocoding. Google Geocoding when GOOGLE_MAPS_API_KEY is set,
// otherwise OpenStreetMap Nominatim (throttled to 1 request/second per their usage policy).
import { config, googleEnabled } from './config.js';

const cache = new Map();
// If Google refuses the key (billing off, API disabled…), use OpenStreetMap for 10 minutes before trying Google again.
let googleDownUntil = 0;
const googleDown = () => Date.now() < googleDownUntil;
function markGoogleDown(j) {
  googleDownUntil = Date.now() + 10 * 60000;
  console.warn(`[geocode] Google refused (${j.status}: ${(j.error_message || '').slice(0, 120)}). Using OpenStreetMap.`);
}
let last = 0;
async function throttle() {
  const wait = Math.max(0, last + 1050 - Date.now());
  last = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}
async function getJson(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': config.places.userAgent, 'Accept-Language': 'en', ...headers }, signal: ctl.signal });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

function shortFromNominatim(a = {}) {
  const area = a.neighbourhood || a.suburb || a.quarter || a.residential || a.city_district || a.village || a.hamlet || a.town || a.city || a.county;
  const city = a.city || a.town || a.village || a.state_district || a.county || a.state;
  return [area, city && city !== area ? city : null].filter(Boolean).join(', ');
}
function shortFromGoogle(components = []) {
  const get = (t) => components.find((c) => c.types.includes(t))?.long_name;
  const area = get('sublocality_level_1') || get('sublocality') || get('neighborhood') || get('locality');
  const city = get('locality') || get('administrative_area_level_2');
  return [area, city && city !== area ? city : null].filter(Boolean).join(', ');
}

export async function search(q, near) {
  q = String(q || '').trim().slice(0, 140);
  if (q.length < 3) return [];
  const key = `s:${q.toLowerCase()}:${near ? near.map((x) => x.toFixed(1)).join(',') : ''}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  if (googleEnabled() && !googleDown()) {
    const bias = near ? `&location=${near[0]},${near[1]}&radius=30000` : '';
    const j = await getJson(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}${bias}&key=${config.places.googleKey}`);
    if (j.status !== 'OK' && j.status !== 'ZERO_RESULTS') { markGoogleDown(j); return search(q, near); }
    out = (j.results || []).slice(0, 6).map((r) => ({
      label: r.formatted_address, short: shortFromGoogle(r.address_components) || r.formatted_address,
      location: [r.geometry.location.lat, r.geometry.location.lng],
    }));
  } else {
    await throttle();
    const vb = near ? `&viewbox=${near[1] - 0.5},${near[0] + 0.5},${near[1] + 0.5},${near[0] - 0.5}` : '';
    const j = await getJson(`${config.places.nominatimUrl}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}${vb}`);
    out = j.map((r) => ({ label: r.display_name, short: shortFromNominatim(r.address) || r.name || r.display_name.split(',')[0], location: [Number(r.lat), Number(r.lon)] }));
  }
  cache.set(key, out);
  return out;
}

export async function reverse(loc) {
  const key = `r:${loc[0].toFixed(4)},${loc[1].toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  let out = { label: `${loc[0].toFixed(4)}, ${loc[1].toFixed(4)}`, short: 'Current location' };
  try {
    if (googleEnabled() && !googleDown()) {
      const j = await getJson(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc[0]},${loc[1]}&key=${config.places.googleKey}`);
      if (j.status !== 'OK' && j.status !== 'ZERO_RESULTS') { markGoogleDown(j); return reverse(loc); }
      const r = j.results?.[0];
      if (r) out = { label: r.formatted_address, short: shortFromGoogle(r.address_components) || r.formatted_address };
    } else {
      await throttle();
      const j = await getJson(`${config.places.nominatimUrl}/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${loc[0]}&lon=${loc[1]}`);
      if (j?.display_name) out = { label: j.display_name, short: shortFromNominatim(j.address) || j.display_name.split(',')[0] };
    }
    cache.set(key, out);
  } catch (e) {
    console.warn('[geocode] reverse failed:', e.message);
  }
  return out;
}
