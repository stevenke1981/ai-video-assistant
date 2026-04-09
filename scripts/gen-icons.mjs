/**
 * Generates simple PNG icons for the Chrome Extension.
 * Uses pure Node.js with a minimal PNG encoder (no deps).
 * Run: node scripts/gen-icons.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(buf) {
  let s1 = 1, s2 = 0;
  for (const b of buf) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
  return (s2 << 16) | s1;
}

function deflateRaw(data) {
  // Simple uncompressed deflate blocks (no compression, just wraps)
  const out = [];
  const BSIZE = 65535;
  for (let i = 0; i < data.length; i += BSIZE) {
    const chunk = data.subarray(i, i + BSIZE);
    const last = (i + BSIZE) >= data.length ? 1 : 0;
    out.push(last, chunk.length & 0xff, (chunk.length >> 8) & 0xff,
      (~chunk.length) & 0xff, ((~chunk.length) >> 8) & 0xff, ...chunk);
  }
  const a = adler32(data);
  const header = [0x78, 0x01]; // zlib: no compression
  const trailer = [(a >>> 24) & 0xff, (a >>> 16) & 0xff, (a >>> 8) & 0xff, a & 0xff];
  return new Uint8Array([...header, ...out, ...trailer]);
}

function makePNG(size, painter) {
  const raw = new Uint8Array(size * size * 4); // RGBA
  painter(raw, size);

  // Filter: prepend 0 (None) before each row
  const filtered = new Uint8Array(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    filtered[y * (size * 4 + 1)] = 0;
    filtered.set(raw.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }

  const compressed = deflateRaw(filtered);

  function chunk(type, data) {
    const tBytes = new TextEncoder().encode(type);
    const len = data.length;
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, len);
    const crcInput = new Uint8Array(4 + len);
    crcInput.set(tBytes); crcInput.set(data, 4);
    const crcVal = crc32(crcInput);
    const crcBuf = new Uint8Array(4);
    new DataView(crcBuf.buffer).setUint32(0, crcVal);
    return new Uint8Array([...lenBuf, ...tBytes, ...data, ...crcBuf]);
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size); dv.setUint32(4, size);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit depth, RGB — wait we need RGBA
  // Actually set color type 6 = RGBA
  ihdr[9] = 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', new Uint8Array(0));

  const total = sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const result = new Uint8Array(total);
  let off = 0;
  for (const part of [sig, ihdrChunk, idatChunk, iendChunk]) {
    result.set(part, off); off += part.length;
  }
  return result;
}

// Color: violet #7c3aed → r=124, g=58, b=237
function paintIcon(pixels, size) {
  const cx = size / 2, cy = size / 2, r = size * 0.45;
  const ri = size * 0.25; // inner radius of camera lens

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const padding = size * 0.08;
      const roundR = size * 0.18; // corner radius for rounded-rect

      // Rounded rectangle background
      const inRect = x >= padding && x <= size - padding &&
                     y >= padding && y <= size - padding;
      // Simplified: draw full rounded rect
      const rx = Math.abs(x - cx), ry = Math.abs(y - cy);
      const halfW = size / 2 - padding, halfH = size / 2 - padding;
      const cornerX = halfW - roundR, cornerY = halfH - roundR;
      let inBg = false;
      if (rx <= halfW && ry <= halfH) {
        if (rx <= cornerX || ry <= cornerY) inBg = true;
        else if (Math.sqrt((rx - cornerX) ** 2 + (ry - cornerY) ** 2) <= roundR) inBg = true;
      }

      // Camera lens circle
      const inLens = dist <= ri;
      // Lens inner (white)
      const inLensInner = dist <= ri * 0.55;
      // Viewfinder bump at top
      const bumpY = y < cy - r * 0.4;
      const bumpX = Math.abs(x - cx) <= size * 0.12;
      const inBump = bumpY && bumpX && y >= cy - r * 0.7 && y <= cy - r * 0.35;

      if (inBg || inBump) {
        // Brand violet
        pixels[idx]   = 124; // R
        pixels[idx+1] = 58;  // G
        pixels[idx+2] = 237; // B
        pixels[idx+3] = 255; // A
      }

      if (inBg && inLensInner) {
        // White center of lens
        pixels[idx]   = 255;
        pixels[idx+1] = 255;
        pixels[idx+2] = 255;
        pixels[idx+3] = 220;
      } else if (inBg && inLens) {
        // Darker ring
        pixels[idx]   = 80;
        pixels[idx+1] = 20;
        pixels[idx+2] = 180;
        pixels[idx+3] = 255;
      }
    }
  }
}

mkdirSync(join(root, 'icons'), { recursive: true });

for (const size of [16, 48, 128]) {
  const png = makePNG(size, paintIcon);
  writeFileSync(join(root, 'icons', `icon${size}.png`), png);
  console.log(`✅ icons/icon${size}.png created (${png.length} bytes)`);
}

console.log('\n🎉 Icons generated successfully!');
