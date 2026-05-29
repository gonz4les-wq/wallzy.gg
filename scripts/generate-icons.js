// Zero-dependency PNG icon generator for the Daily PWA.
// Draws a rounded indigo gradient tile with a white checklist + check glyph.
// Run: node scripts/generate-icons.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function makeIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  // Safe area padding for glyph; maskable needs extra inner padding.
  const pad = maskable ? size * 0.18 : size * 0.0;

  const set = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    // simple alpha-over onto existing
    const da = buf[i + 3] / 255;
    const sa = a / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / oa);
    buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / oa);
    buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / oa);
    buf[i + 3] = Math.round(oa * 255);
  };

  const inRounded = (x, y) => {
    if (radius <= 0) return true;
    const minX = radius, maxX = size - radius;
    const minY = radius, maxY = size - radius;
    let cx = x, cy = y;
    if (x < minX) cx = minX; else if (x > maxX) cx = maxX;
    if (y < minY) cy = minY; else if (y > maxY) cy = maxY;
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  // Background gradient (indigo -> violet), diagonal.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRounded(x, y)) continue;
      const t = (x + y) / (2 * size);
      const r = lerp(0x4f, 0x7c, t);
      const g = lerp(0x46, 0x3a, t);
      const b = lerp(0xe5, 0xed, t);
      set(x, y, r, g, b, 255);
    }
  }

  // Glyph area
  const gx = pad, gy = pad, gs = size - pad * 2;
  const fillRect = (rx, ry, rw, rh, rr, col, alpha = 255) => {
    for (let y = Math.floor(ry); y < ry + rh; y++) {
      for (let x = Math.floor(rx); x < rx + rw; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        // rounded corners on the rect
        if (rr > 0) {
          const minX = rx + rr, maxX = rx + rw - rr;
          const minY = ry + rr, maxY = ry + rh - rr;
          let cx = x, cy = y;
          if (x < minX) cx = minX; else if (x > maxX) cx = maxX;
          if (y < minY) cy = minY; else if (y > maxY) cy = maxY;
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > rr * rr) continue;
        }
        set(x, y, col[0], col[1], col[2], alpha);
      }
    }
  };

  // Three checklist rows: small box + line, white.
  const white = [255, 255, 255];
  const rows = 3;
  const rowH = gs * 0.12;
  const gap = gs * 0.13;
  const startY = gy + gs * 0.16;
  const boxX = gx + gs * 0.08;
  const boxS = rowH;
  for (let r = 0; r < rows; r++) {
    const y = startY + r * (rowH + gap);
    fillRect(boxX, y, boxS, boxS, boxS * 0.28, white, 255);
    // line
    fillRect(boxX + boxS * 1.5, y + boxS * 0.22, gs * 0.55, boxS * 0.56, boxS * 0.28, white, 230);
  }

  // Big check mark overlay on the last box (accent area) drawn as two thick strokes.
  const cm = [
    [boxX + boxS * 0.22, startY + 2 * (rowH + gap) + boxS * 0.55],
    [boxX + boxS * 0.45, startY + 2 * (rowH + gap) + boxS * 0.78],
    [boxX + boxS * 0.82, startY + 2 * (rowH + gap) + boxS * 0.2],
  ];
  const thick = boxS * 0.16;
  const stroke = (a, b) => {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = a[0] + (b[0] - a[0]) * t;
      const cy = a[1] + (b[1] - a[1]) * t;
      for (let dy = -thick; dy <= thick; dy++)
        for (let dx = -thick; dx <= thick; dx++)
          if (dx * dx + dy * dy <= thick * thick)
            set(Math.round(cx + dx), Math.round(cy + dy), 0x4f, 0x46, 0xe5, 255);
    }
  };
  stroke(cm[0], cm[1]);
  stroke(cm[1], cm[2]);

  return encodePNG(size, size, buf);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makeIcon(512, { maskable: true }));
console.log('Icons written to', outDir);
