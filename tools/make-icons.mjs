// Renders the CrowdKart icon to PNG without dependencies (supersampled vector math + zlib).
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const cart = [[150, 180], [190, 180], [224, 300], [344, 300], [374, 210], [210, 210]];

// Colour at a point in the 512x512 design space.
function sample(x, y) {
  const r = 112; // rounded rect
  const cx = Math.max(r, Math.min(512 - r, x)), cy = Math.max(r, Math.min(512 - r, y));
  if (Math.hypot(x - cx, y - cy) > r) return null;
  for (let i = 0; i < cart.length - 1; i++) if (segDist(x, y, ...cart[i], ...cart[i + 1]) <= 16) return [255, 255, 255];
  if (Math.hypot(x - 240, y - 350) <= 22 || Math.hypot(x - 330, y - 350) <= 22) return [255, 255, 255];
  const d = Math.hypot(x - 256, y - 230);
  if (Math.abs(d - 150) <= 9) { const a = (Math.atan2(y - 230, x - 256) + Math.PI) * 150; if (a < 0) return null; }
  return [19, 128, 78];
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let rr = 0, gg = 0, bb = 0, aa = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = sample(((x + (sx + 0.5) / ss) / size) * 512, ((y + (sy + 0.5) / ss) / size) * 512);
      if (c) { rr += c[0]; gg += c[1]; bb += c[2]; aa += 1; }
    }
    const i = (y * size + x) * 4;
    if (aa) { buf[i] = rr / aa; buf[i + 1] = gg / aa; buf[i + 2] = bb / aa; }
    buf[i + 3] = Math.round((aa / (ss * ss)) * 255);
  }
  return png(size, buf);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
for (const [file, size] of [['client/public/icon-192.png', 192], ['client/public/icon-512.png', 512], ['desktop/icon.png', 512]]) {
  fs.writeFileSync(path.join(root, file), render(size));
  console.log('wrote', file);
}
