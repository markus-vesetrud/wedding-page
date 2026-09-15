import { deflateSync } from 'node:zlib';
import type { GradientStop } from './draw-helpers.js';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBytes, Buffer.from(data), crc]);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Builds a 1px-wide, `height`px-tall RGBA PNG encoding a smooth top-to-bottom
 * gradient (row 0 = top, matching CSS `linear-gradient` direction).
 *
 * @libpdf/core's shading API has no per-stop alpha, and its rectangle/path
 * opacity is a single constant value — there is no way to draw a true
 * smoothly-varying alpha fill directly. Stacking many thin opaque rectangles
 * approximates it, but adjacent rectangle edges get anti-aliased against the
 * content below, leaving visible seams. A PNG's alpha channel *is* fully
 * supported (embedPng turns it into a real PDF soft mask), so baking the
 * gradient into an image and drawing that instead gives a genuinely smooth
 * result with no extra dependencies.
 */
export function buildVerticalGradientPng(stops: GradientStop[], height = 2000): Uint8Array {
  const raw = Buffer.alloc(height * (1 + 4));

  for (let row = 0; row < height; row++) {
    const t = row / (height - 1);

    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].offset && t <= stops[s + 1].offset) {
        lo = stops[s];
        hi = stops[s + 1];
        break;
      }
    }
    const span = hi.offset - lo.offset;
    const segmentT = span === 0 ? 0 : (t - lo.offset) / span;

    const r = Math.round(lerp(lo.color[0], hi.color[0], segmentT));
    const g = Math.round(lerp(lo.color[1], hi.color[1], segmentT));
    const b = Math.round(lerp(lo.color[2], hi.color[2], segmentT));
    const a = Math.round(lerp(lo.alpha, hi.alpha, segmentT) * 255);

    const offset = row * 5;
    raw[offset] = 0; // filter type: None
    raw[offset + 1] = r;
    raw[offset + 2] = g;
    raw[offset + 3] = b;
    raw[offset + 4] = a;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw);

  return new Uint8Array(Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]));
}
