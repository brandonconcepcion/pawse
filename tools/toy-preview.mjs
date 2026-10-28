// Draws a toy model from several angles into a PNG, so you can check it without a browser.
//   node tools/toy-preview.mjs <kind> [color] [frames] [out.png] [scale]
//   node tools/toy-preview.mjs sweater-bear red 0,3,6,12,18 /tmp/bear.png 8
// frames: comma-separated angles 0-23 (15° each; frame 0 is the front). Defaults to 0,3,6,9,12,15,18,21.
// Also prints the model's bounding box over ALL 24 angles: if it touches an edge, the sprite gets clipped.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { MODELS, rasterize, spriteSize, DEFAULT_COLOR, TOY_COLORS, FRAMES } from '../js/toys.js';

const [kind, colorArg, framesArg, out = '/tmp/toy-preview.png', scaleArg = '8'] = process.argv.slice(2);
if (!MODELS[kind]) {
  console.error(`Unknown model "${kind}". Models: ${Object.keys(MODELS).join(', ')}`);
  process.exit(1);
}
const color = colorArg && colorArg !== '-' ? colorArg : DEFAULT_COLOR[kind];
if (!TOY_COLORS[color]) {
  console.error(`Unknown color "${color}". Colors: ${Object.keys(TOY_COLORS).join(', ')}`);
  process.exit(1);
}
const frames = (framesArg && framesArg !== '-' ? framesArg : '0,3,6,9,12,15,18,21').split(',').map(Number);
const scale = Number(scaleArg);

const model = MODELS[kind](color);
const { w: W, h: H } = spriteSize(model); // 32×32, or wider/taller for a two-slot toy (`span: 2`)
const angle = (frame) => ((((frame + (model.face ?? 0)) % FRAMES) + FRAMES) % FRAMES) / FRAMES * Math.PI * 2;

// Bounding box across every angle (the shadow doesn't count).
let [minX, maxX, minY, maxY] = [W, -1, H, -1];
for (let f = 0; f < FRAMES; f++) {
  rasterize(model, angle(f)).forEach((c, i) => {
    if (!c || c === 'shadow') return;
    minX = Math.min(minX, i % W); maxX = Math.max(maxX, i % W);
    minY = Math.min(minY, Math.floor(i / W)); maxY = Math.max(maxY, Math.floor(i / W));
  });
}
console.log(`${kind} (${color}): columns ${minX}-${maxX} of 0-${W - 1}, rows ${minY}-${maxY} of 0-${H - 1} over all ${FRAMES} angles`);
if (minX < 1 || maxX > W - 2 || minY < 1 || maxY > H - 2) console.log('WARNING: touches the sprite edge, so it will be clipped. Make the model smaller.');

// Paint the frames side by side on a gray backdrop (shadow = darker gray) and write a PNG.
const width = W * frames.length * scale;
const height = H * scale;
const raw = Buffer.alloc((width * 3 + 1) * height);
const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
frames.forEach((frame, slot) => {
  const pixels = rasterize(model, angle(frame));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // PNG filter: none
    for (let x = 0; x < W * scale; x++) {
      const c = pixels[Math.floor(y / scale) * W + Math.floor(x / scale)];
      const [r, g, b] = !c ? [150, 160, 170] : c === 'shadow' ? [105, 112, 128] : rgb(c);
      raw.set([r, g, b], y * (width * 3 + 1) + 1 + (slot * W * scale + x) * 3);
    }
  }
});
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => (buf.reduce((c, byte) => crcTable[(c ^ byte) & 255] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(body));
  return Buffer.concat([head, body, tail]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header.set([8, 2, 0, 0, 0], 8);
writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(`wrote ${out} (frames ${frames.join(',')} at ${scale}x)`);
