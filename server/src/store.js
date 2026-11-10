// Tiny JSON-file document store with MongoDB-style collections.
// Collections mirror the planned MongoDB schema. Orders (private) and
// OrderSignals (anonymous) are kept strictly separate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const COLLECTIONS = ['users', 'merchants', 'zones', 'orders', 'orderSignals', 'groups', 'payments', 'deliveries', 'savings', 'brandProducts'];
const file = () => path.join(config.dataDir, 'db.json');

let db = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
let saveTimer = null;

export function load() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (fs.existsSync(file())) {
    try {
      const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
      for (const c of COLLECTIONS) db[c] = raw[c] || [];
    } catch (e) {
      console.warn('[store] could not parse db.json, starting fresh:', e.message);
    }
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(db, null, 2));
  }, 150);
}

export const id = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

export const col = (name) => ({
  all: () => db[name],
  find: (pred = () => true) => db[name].filter(pred),
  findOne: (pred) => db[name].find(pred),
  get: (docId) => db[name].find((d) => d.id === docId),
  insert(doc) { db[name].push(doc); persist(); return doc; },
  update(docId, patch) {
    const d = db[name].find((x) => x.id === docId);
    if (!d) return null;
    Object.assign(d, typeof patch === 'function' ? patch(d) || {} : patch, { updatedAt: Date.now() });
    persist();
    return d;
  },
  remove(pred) { db[name] = db[name].filter((d) => !pred(d)); persist(); },
  replaceAll(docs) { db[name] = docs; persist(); },
});

export const save = persist;
export function reset() { db = Object.fromEntries(COLLECTIONS.map((c) => [c, []])); persist(); }
