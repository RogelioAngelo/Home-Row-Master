/**
 * generate-icons.js
 * Run with: node generate-icons.js
 * Generates icon16.png, icon48.png, icon128.png using only Node.js built-ins
 * (writes minimal PNG files from scratch using pure JS)
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR);

// ── Minimal PNG writer ──────────────────────────────────────────────────────
function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (~crc) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len       = uint32BE(data.length);
  const crcInput  = Buffer.concat([typeBytes, data]);
  const crcBytes  = uint32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBytes]);
}

function encodePNG(width, height, rgba) {
  // Build raw scanlines
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter byte (None)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw.push(rgba[i], rgba[i+1], rgba[i+2], rgba[i+3]);
    }
  }
  const rawBuf     = Buffer.from(raw);
  const compressed = zlib.deflateSync(rawBuf, { level: 9 });

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const IHDR = chunk('IHDR', Buffer.concat([
    uint32BE(width), uint32BE(height),
    Buffer.from([8, 2, 0, 0, 0]) // 8-bit depth, RGB... wait we need RGBA: color type 6
  ]));

  // Re-do IHDR with color type 6 (RGBA)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width,  0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8]  = 8;  // bit depth
  ihdrData[9]  = 6;  // color type: RGBA
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace

  const pngChunks = [
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat(pngChunks);
}

// ── Icon drawing ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0,2), 16),
    parseInt(h.slice(2,4), 16),
    parseInt(h.slice(4,6), 16),
  ];
}

function drawIcon(size) {
  const rgba = new Uint8Array(size * size * 4);

  const BG    = [9,  13,  26];   // #090d1a
  const CYAN  = [56, 189, 248];  // #38bdf8
  const DIM   = [20, 40,  80];   // dimmed key
  const HOME  = [15, 60, 100];   // home key bg

  // Fill background
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    rgba[o]   = BG[0];
    rgba[o+1] = BG[1];
    rgba[o+2] = BG[2];
    rgba[o+3] = 255;
  }

  // Draw rounded rect helper
  function rect(x, y, w, h, color, alpha = 255) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px < 0 || py < 0 || px >= size || py >= size) continue;
        const o  = (py * size + px) * 4;
        const a  = alpha / 255;
        rgba[o]   = Math.round(rgba[o]   * (1 - a) + color[0] * a);
        rgba[o+1] = Math.round(rgba[o+1] * (1 - a) + color[1] * a);
        rgba[o+2] = Math.round(rgba[o+2] * (1 - a) + color[2] * a);
        rgba[o+3] = 255;
      }
    }
  }

  // Draw keyboard rows relative to icon size
  const pad   = Math.round(size * 0.08);
  const kw    = size - pad * 2;
  const keyH  = Math.max(2, Math.round(size * 0.14));
  const gap   = Math.max(1, Math.round(size * 0.04));
  const rowH  = keyH + gap;

  // 3 rows: top row, HOME row, bottom row
  const totalH = rowH * 3 - gap;
  const startY = Math.round((size - totalH) / 2);

  // Row 1 — 10 small keys, dimmed
  const nTop    = 10;
  const keyW1   = Math.max(1, Math.round((kw - gap * (nTop - 1)) / nTop));
  for (let k = 0; k < nTop; k++) {
    const kx = pad + k * (keyW1 + gap);
    const ky = startY;
    rect(kx, ky, keyW1, keyH, DIM);
  }

  // Row 2 — HOME row (10 keys), glowing CYAN
  const nHome   = 10;
  const indent2 = Math.round(size * 0.06);
  const kw2     = kw - indent2;
  const keyW2   = Math.max(1, Math.round((kw2 - gap * (nHome - 1)) / nHome));
  for (let k = 0; k < nHome; k++) {
    const kx = pad + indent2 + k * (keyW2 + gap);
    const ky = startY + rowH;
    // glow: draw slightly larger in dim, then the key on top
    rect(kx - 1, ky - 1, keyW2 + 2, keyH + 2, CYAN, 40);
    rect(kx, ky, keyW2, keyH, HOME);
    // Top highlight
    rect(kx, ky, keyW2, 1, CYAN, 180);
  }

  // Row 3 — 7 small keys, dimmed
  const nBot    = 7;
  const indent3 = Math.round(size * 0.13);
  const kw3     = kw - indent3;
  const keyW3   = Math.max(1, Math.round((kw3 - gap * (nBot - 1)) / nBot));
  for (let k = 0; k < nBot; k++) {
    const kx = pad + indent3 + k * (keyW3 + gap);
    const ky = startY + rowH * 2;
    rect(kx, ky, keyW3, keyH, DIM);
  }

  return Buffer.from(rgba.buffer);
}

// ── Generate & write ────────────────────────────────────────────────────────
[16, 48, 128].forEach(size => {
  const rgba = drawIcon(size);
  const png  = encodePNG(size, size, rgba);
  const out  = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`✅  Written ${out} (${png.length} bytes)`);
});

console.log('\n🎉  All icons generated in ./icons/');
