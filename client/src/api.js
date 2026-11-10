// API client. Works for web (same origin), Electron (embedded server) and Capacitor (remote server).
const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.());
const isFile = () => location.protocol === 'file:';

// Web tabs use sessionStorage so two tabs = two demo users. Native apps persist with localStorage.
const store = () => (isNative() || isFile() || window.crowdkartDesktop ? localStorage : sessionStorage);

export const platform = () => (window.crowdkartDesktop ? 'desktop' : isNative() ? window.Capacitor.getPlatform() : 'web');

export function serverUrl() {
  const saved = localStorage.getItem('ck_server');
  if (saved) return saved.replace(/\/$/, '');
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  if (window.crowdkartDesktop?.serverUrl) return window.crowdkartDesktop.serverUrl;
  if (isNative() || isFile()) return 'http://localhost:4000';
  return '';
}
export const setServerUrl = (u) => (u ? localStorage.setItem('ck_server', u) : localStorage.removeItem('ck_server'));
export const needsServerChoice = () => isNative();

export const getToken = () => store().getItem('ck_token');
export const getUser = () => { try { return JSON.parse(store().getItem('ck_user') || 'null'); } catch { return null; } };
export function setSession(token, user) {
  if (token) { store().setItem('ck_token', token); store().setItem('ck_user', JSON.stringify(user)); }
  else { store().removeItem('ck_token'); store().removeItem('ck_user'); }
}

async function req(method, path, body) {
  const res = await fetch(`${serverUrl()}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && getToken()) { setSession(null); location.hash = '#/login'; }
  if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b || {}),
  patch: (p, b) => req('PATCH', p, b || {}),
  put: (p, b) => req('PUT', p, b || {}),
};

export const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
