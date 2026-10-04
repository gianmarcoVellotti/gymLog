// Genera le icone PNG della PWA senza dipendenze (solo moduli built-in di Node).
// Uso: npm run icons   →   scrive in public/
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(outDir, { recursive: true });

// Distanza con segno da un rettangolo arrotondato (coordinate normalizzate 0..1)
const rr = (u, v, cx, cy, hw, hh, r) => {
  const dx = Math.abs(u - cx) - (hw - r);
  const dy = Math.abs(v - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
// Manubrio: barra + dischi interni + dischi esterni + fermi (entro l'80% centrale: sicuro per le maschere)
const glyph = (u, v) =>
  rr(u, v, 0.5, 0.5, 0.2, 0.03, 0.03) < 0 ||
  rr(u, v, 0.29, 0.5, 0.03, 0.17, 0.02) < 0 ||
  rr(u, v, 0.71, 0.5, 0.03, 0.17, 0.02) < 0 ||
  rr(u, v, 0.225, 0.5, 0.025, 0.11, 0.02) < 0 ||
  rr(u, v, 0.775, 0.5, 0.025, 0.11, 0.02) < 0 ||
  rr(u, v, 0.17, 0.5, 0.02, 0.055, 0.015) < 0 ||
  rr(u, v, 0.83, 0.5, 0.02, 0.055, 0.015) < 0;

const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const background = (u, v) => {
  const base = mix([0x1d, 0x0b, 0x45], [0x05, 0x04, 0x08], Math.min(1, v * 0.9));
  const d = Math.hypot(u - 0.8, v - 0.1);
  return mix(base, [0x8b, 0x5c, 0xf6], Math.max(0, 1 - d / 0.9) ** 1.4);
};

function render(size) {
  const ss = 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++)
          if (glyph((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)) cov++;
      const t = cov / (ss * ss);
      const bg = background((x + 0.5) / size, (y + 0.5) / size);
      const px = mix(bg, [0xf5, 0xf2, 0xff], t);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = 255;
    }
  }
  return raw;
}

function png(size) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['apple-touch-icon.png', 180],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-512x512.png', 512],
];
for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), png(size));
  console.log('scritto', name, `${size}x${size}`);
}
