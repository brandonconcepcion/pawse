// All of Pawse's pixel art, drawn in code (no image files to download or license).
// Colors come from the PICO-8 16-color palette, plus a few sky tints.

export const C = {
  black: '#000000',
  navy: '#1D2B53',
  plum: '#7E2553',
  forest: '#008751',
  brown: '#AB5236',
  slate: '#5F574F',
  silver: '#C2C3C7',
  cream: '#FFF1E8',
  red: '#FF004D',
  orange: '#FFA300',
  yellow: '#FFEC27',
  green: '#00E436',
  blue: '#29ADFF',
  lavender: '#83769C',
  pink: '#FF77A8',
  peach: '#FFCCAA',
  // extras for a sunny sky and leafy greens
  sky2: '#5CC3FF',
  sky3: '#8FD8FF',
  sky4: '#C8EEFF',
  leaf: '#00B543',
  lawn: '#08CC3B',
  // Teddy's colors
  tan: '#A07E5E',
  cocoa: '#3B2416',
};

// ---------------------------------------------------------------------------
// Dogs
// ---------------------------------------------------------------------------

export const COATS = {
  golden: { label: 'Golden', body: C.orange, shade: C.brown, light: C.peach },
  chocolate: { label: 'Chocolate', body: C.brown, shade: C.plum, light: C.peach },
  black: { label: 'Black', body: C.slate, shade: C.navy, light: C.silver },
  white: { label: 'White', body: C.cream, shade: C.silver, light: C.cream },
  gray: { label: 'Gray', body: C.silver, shade: C.lavender, light: C.cream },
  cream: { label: 'Cream', body: C.peach, shade: C.orange, light: C.cream },
  // Teddy: fluffy white pup, grey-brown left ear, a brown stripe on the right ear,
  // a brown spot on the right thigh by his tail, black nose, dark brown eyes, no collar.
  teddy: {
    label: 'Teddy',
    body: C.cream,
    shade: '#DCD3CA', // warm light-grey fur shading
    light: '#FFFFFF',
    marking: C.tan,
    eye: C.cocoa,
    nose: C.black,
    collar: C.cream,
    fluffy: true,
    markings: true,
  },
  // Cookie: all-white fluffball with dark eyes, a dark brown nose, and a pink gym sweatband.
  cookie: {
    label: 'Cookie',
    body: C.cream,
    shade: '#E6DED7',
    light: '#FFFFFF',
    ear: '#EFE7E0',
    eye: C.navy,
    nose: '#4A3428',
    collar: C.cream,
    band: C.pink,
    fluffy: true,
  },
};

const coatOf = (id) => COATS[id] ?? COATS.golden;

export const SIZES = {
  regular: { label: 'Regular' },
  small: { label: 'Small' },
  plump: { label: 'Plump' },
};

// Each pose is a list of [x, y, w, h, part] rectangles in an 18×14 box, facing right.
// An outline is drawn automatically around everything, so shapes stay chunky and readable.
// Poses also say where the head sits (for ears & fluff) and where the back thigh is (for markings).

const head = (dx = 0, dy = 0) => [
  [10 + dx, 1 + dy, 5, 5, 'body'],
  [14 + dx, 3 + dy, 2, 2, 'body'],
  [10 + dx, 1 + dy, 2, 4, 'ear'], // floppy ear
];

const face = (dx = 0, dy = 0, { tongue = false, sleepy = false } = {}) => [
  [13 + dx, 2 + dy, 1, 1, sleepy ? 'shade' : 'eye'],
  [15 + dx, 3 + dy, 1, 1, 'nose'],
  [10 + dx, 5 + dy, 1, 2, 'collar'],
  ...(tongue ? [[14 + dx, 5 + dy, 1, 1, 'tongue']] : []),
];

const RUN_LEGS = [
  [2, 4, 11, 13],
  [3, 5, 10, 12],
  [4, 6, 9, 11],
  [3, 5, 10, 12],
];
const WALK_LEGS = [
  [3, 5, 10, 12],
  [4, 6, 9, 11],
];

const POSES = {
  run: (f) => ({
    bob: f % 2 === 0 ? 0 : -1,
    standing: true,
    head: [0, 0],
    thigh: [2, 5, 3, 2],
    rects: [
      ...(f % 2 === 0 ? [[0, 3, 2, 1, 'body'], [0, 2, 1, 1, 'body']] : [[0, 4, 2, 1, 'body']]),
      [2, 5, 10, 4, 'body'],
      [4, 8, 6, 1, 'light'],
      ...RUN_LEGS[f % 4].map((x) => [x, 9, 1, 3, 'body']),
      ...head(),
    ],
    details: face(0, 0, { tongue: true }),
  }),

  walk: (f) => ({
    bob: 0,
    standing: true,
    head: [0, 0],
    thigh: [2, 5, 3, 2],
    rects: [
      [0, 3, 2, 1, 'body'],
      [0, 2, 1, 1, 'body'],
      [2, 5, 10, 4, 'body'],
      [4, 8, 6, 1, 'light'],
      ...WALK_LEGS[f % 2].map((x) => [x, 9, 1, 3, 'body']),
      ...head(),
    ],
    details: face(),
  }),

  sniff: (f) => ({
    bob: 0,
    standing: true,
    head: [1, 4],
    thigh: [2, 4, 3, 2],
    rects: [
      [0, 2, 2, 1, 'body'],
      [0, 1, 1, 1, 'body'],
      [2, 4, 10, 4, 'body'],
      [4, 7, 6, 1, 'light'],
      ...WALK_LEGS[f % 2].map((x) => [x, 8, 1, 4, 'body']),
      ...head(1, 4),
    ],
    details: face(1, 4),
  }),

  sit: (f, wag = false) => ({
    bob: 0,
    head: [0, 0],
    thigh: [3, 9, 3, 2],
    rects: [
      wag && f % 2 === 0 ? [1, 8, 3, 1, 'body'] : [1, 11, 3, 1, 'body'],
      wag && f % 2 === 0 ? [0, 7, 1, 1, 'body'] : [0, 11, 1, 1, 'body'],
      [4, 6, 7, 6, 'body'],
      [3, 9, 4, 3, 'shade'], // haunch
      [9, 9, 1, 3, 'body'],
      [11, 9, 1, 3, 'body'],
      [7, 9, 2, 3, 'light'], // chest
      ...head(),
    ],
    details: face(0, 0, { tongue: wag }),
  }),

  wag: (f) => POSES.sit(f, true),

  lie: (f, sleepy = false) => ({
    bob: 0,
    head: [0, 3],
    thigh: [2, 8, 3, 2],
    rects: [
      [0, 9, 2, 1, 'body'],
      [2, 8, 10, 3, 'body'],
      [3, 10, 4, 1, 'shade'],
      [12, 10, 3, 1, 'body'], // front paws
      ...head(0, 3),
    ],
    details: face(0, 3, { sleepy }),
  }),

  sleep: (f) => POSES.lie(f, true),

  roll: (f) => {
    const kick = f % 2;
    return {
      bob: 0,
      head: null,
      thigh: [2, 9, 3, 2],
      rects: [
        [0, 9, 2, 1, 'body'],
        [2, 7, 10, 4, 'body'],
        [4, 7, 6, 1, 'light'], // belly up!
        ...[3, 5, 9, 11].map((x, i) => [x, 4 + ((i + kick) % 2), 1, 3 - ((i + kick) % 2), 'body']),
        [11, 6, 5, 4, 'body'],
        [11, 9, 2, 2, 'ear'],
      ],
      details: [
        [14, 7, 1, 1, 'eye'],
        [16, 8, 1, 1, 'nose'],
        [15, 10, 1, 1, 'tongue'],
      ],
    };
  },

  beg: (f) => {
    const up = f % 2;
    return {
      bob: 0,
      head: [-2, -1],
      thigh: [4, 9, 3, 2],
      rects: [
        [1, 11, 3, 1, 'body'],
        [6, 4, 5, 7, 'body'],
        [4, 9, 5, 3, 'shade'],
        [9, 5, 2, 5, 'light'],
        [11, 4 + up, 2, 1, 'body'],
        [11, 6 + up, 2, 1, 'body'],
        ...head(-2, -1),
      ],
      details: face(-2, -1, { tongue: true }),
    };
  },

  bow: (f) => ({
    bob: 0,
    head: [1, 3],
    thigh: [2, 3, 3, 2],
    rects: [
      ...(f % 2 === 0 ? [[0, 1, 2, 1, 'body'], [0, 0, 1, 1, 'body']] : [[0, 2, 2, 1, 'body']]),
      [2, 3, 6, 4, 'body'],
      [7, 6, 5, 3, 'body'],
      [3, 7, 1, 5, 'body'],
      [5, 7, 1, 5, 'body'],
      [9, 9, 6, 2, 'body'], // forearms on the ground
      ...head(1, 3),
    ],
    details: face(1, 3, { tongue: true }),
  }),

  jump: (f) => {
    const up = f % 2 === 0;
    return {
      bob: up ? -4 : 0,
      standing: true,
      head: [0, 0],
      thigh: [2, 5, 3, 2],
      rects: [
        [0, 2, 2, 1, 'body'],
        [0, 1, 1, 1, 'body'],
        [2, 5, 10, 4, 'body'],
        [4, 8, 6, 1, 'light'],
        [1, 9, 1, 2, 'body'],
        [3, 9, 1, 2, 'body'],
        [12, 8, 1, 2, 'body'],
        [13, 7, 1, 2, 'body'],
        ...head(),
      ],
      details: face(0, 0, { tongue: true }),
    };
  },
};

function dogPose(pose, frame = 0) {
  return (POSES[pose] ?? POSES.sit)(frame);
}

/** Small dogs: a shorter body (2px narrower through the middle) and, when standing, shorter legs. */
function shrink(shape) {
  const narrow = ([x, y, w, h, part]) => {
    if (x >= 7) return [x - 2, y, w, h, part];
    if (x + w > 7) return [x, y, Math.max(1, w - Math.min(2, x + w - 7)), h, part];
    return [x, y, w, h, part];
  };
  const lower = ([x, y, w, h, part]) => {
    if (!shape.standing) return [x, y, w, h, part];
    if (y >= shape.legTop) return [x, y + 1, w, Math.max(1, h - 1), part]; // shorter legs, same feet
    return [x, y + 1, w, h, part];
  };
  const fix = (r) => lower(narrow(r)).map((v, i) => (i === 0 ? v + 1 : v)); // re-center in the box
  return { ...shape, rects: shape.rects.map(fix), details: shape.details.map(fix) };
}

/** Adds a rounder belly/back to the main body block. level 1 = chubby, 2 = plump. */
function roundOut(shape, pose, level) {
  const body = shape.rects
    .filter((r) => r[4] === 'body')
    .reduce((best, r) => (r[2] * r[3] > best[2] * best[3] ? r : best));
  const [x, y, w, h] = body;
  const extra = [];
  if (['run', 'walk', 'sniff', 'jump', 'bow'].includes(pose)) {
    extra.push([x + 1, y + h, w - 2, 1, 'body']); // belly hangs a little lower
    if (level === 2) extra.push([x + 1, y - 1, w - 3, 1, 'body']); // rounder back
  } else if (['sit', 'wag', 'beg'].includes(pose)) {
    extra.push([x + w, y + 2, 1, h - 3, 'body']); // tummy pokes out in front
    if (level === 2) extra.push([x - 1, y + 1, 1, h - 2, 'body']);
  } else {
    extra.push([x + 1, y - 1, w - 3, 1, 'body']); // lying down: round back
    if (level === 2) extra.push([x + 2, y + h, w - 5, 1, 'body']);
  }
  return { ...shape, rects: [...shape.rects, ...extra] };
}

/** Draws a dog onto a canvas context at (x, y), 1 unit = 1 pixel. flip = face left. */
export function drawDog(ctx, x, y, coatId, pose, frame = 0, flip = false, size = 'regular') {
  const coat = coatOf(coatId);
  const colors = {
    eye: C.navy,
    nose: C.navy,
    collar: C.red,
    ear: coat.shade,
    ...coat,
    tongue: C.pink,
    outline: C.navy,
  };
  const base = dogPose(pose, frame);
  let shape = { ...base, rects: [...base.rects], details: [...base.details] };
  shape.legTop = pose === 'sniff' ? 8 : 9;
  const hd = shape.head;

  if (coat.fluffy && hd) {
    // shaggy tuft on top of the head and a little beard under the snout
    shape.rects.push([11 + hd[0], hd[1], 3, 1, 'body'], [14 + hd[0], 5 + hd[1], 2, 1, 'body']);
  }

  if (coat.markings) {
    // Facing right shows the dog's LEFT side; facing left shows the RIGHT side.
    if (flip) {
      colors.ear = coat.body;
      if (hd) shape.details.push([11 + hd[0], 2 + hd[1], 1, 3, 'marking']); // brown stripe on right ear
      if (shape.thigh) shape.details.push([...shape.thigh, 'marking']); // spot on right thigh
    } else {
      colors.ear = coat.marking; // brown left ear
    }
  }

  if (coat.band && hd) {
    shape.details.push([10 + hd[0], 1 + hd[1], 5, 1, 'band'], [9 + hd[0], 2 + hd[1], 1, 1, 'band']);
  }

  // 'chubby' and 'plump' are small dogs with a rounder middle.
  if (size === 'small' || size === 'chubby' || size === 'plump') shape = shrink(shape);
  if (size === 'chubby' || size === 'plump') shape = roundOut(shape, pose, size === 'plump' ? 2 : 1);

  const { rects, details, bob } = shape;
  const px = (rx, w) => (flip ? x + 18 - rx - w : x + rx);

  ctx.fillStyle = colors.outline;
  for (const [rx, ry, w, h] of rects) ctx.fillRect(px(rx, w) - 1, y + ry + bob - 1, w + 2, h + 2);
  for (const [rx, ry, w, h, part] of rects) {
    ctx.fillStyle = colors[part];
    ctx.fillRect(px(rx, w), y + ry + bob, w, h);
  }
  for (const [rx, ry, w, h, part] of details) {
    ctx.fillStyle = colors[part];
    ctx.fillRect(px(rx, w), y + ry + bob, w, h);
  }
}

// ---------------------------------------------------------------------------
// Icons (letter grids). Each letter maps to a palette color; '.' is transparent.
// ---------------------------------------------------------------------------

const KEY = {
  k: C.navy, w: C.cream, y: C.yellow, g: C.green, G: C.forest, o: C.orange, b: C.brown,
  l: C.peach, r: C.red, c: C.blue, p: C.pink, s: C.silver,
};

const ICONS = {
  ball: [
    '..kkkk..',
    '.kyyywk.',
    'kyyywyyk',
    'kyywyyyk',
    'kyywyyyk',
    'kyyywyyk',
    '.kwyyyk.',
    '..kkkk..',
  ],
  rope: [
    'kk....kk',
    'krk..kwk',
    '.kwkkrk.',
    '..krwk..',
    '..kwrk..',
    '.krkkwk.',
    'kwk..krk',
    'kk....kk',
  ],
  squeaky: [
    '.kkk....',
    'kyyyk...',
    'kykyookk',
    'kyyykkk.',
    'kyyyyykk',
    'kyyyyyyk',
    '.kyyyyk.',
    '..kkkk..',
  ],
  plush: [
    'kk....kk',
    'kbkkkkbk',
    '.kbbbbk.',
    'kbkbbkbk',
    'kbbllbbk',
    'kbblklbk',
    '.kbbbbk.',
    '..kkkk..',
  ],
  chew: [
    '..........',
    '..........',
    '.kk....kk.',
    'kwwkkkkwwk',
    '.kwwwwwwk.',
    '.kwwwwwsk.',
    'kwwkkkkwwk',
    '.kk....kk.',
    '..........',
    '..........',
  ],
  frisbee: [
    '........',
    '..kkkk..',
    '.kcwwck.',
    'kcccccck',
    'kcckkcck',
    '.kcccck.',
    '..kkkk..',
    '........',
  ],
  puzzle: [
    '...kk...',
    '..kgk...',
    'kkkggkkk',
    'kggggggk',
    '.kgggggk',
    'kggggggk',
    'kkkggkkk',
    '...kk...',
  ],
  other: [
    '.kk.kk..',
    '..kyk...',
    'kkkykkkk',
    'krrryrrk',
    'kyyyyyyk',
    'krrryrrk',
    'krrryrrk',
    'kkkkkkkk',
  ],
  paw: [
    '.kk..kk.',
    '.kk..kk.',
    '........',
    'k.kkkk.k',
    '.kkkkkk.',
    '.kkkkkk.',
    '..kkkk..',
    '........',
  ],
  heart: [
    '.kk.kk..',
    'krrkrrk.',
    'krrrrrk.',
    'krrrrrk.',
    '.krrrk..',
    '..krk...',
    '...k....',
    '........',
  ],
  log: [
    '.kkkkkk.',
    'kwwwwwwk',
    'kwkkkkwk',
    'kwwwwwwk',
    'kwkkkwwk',
    'kwwwwwwk',
    'kwkkkkwk',
    '.kkkkkk.',
  ],
  gym: [
    '..........',
    '..........',
    '.k......k.',
    'kk......kk',
    'kksssssskk',
    'kk......kk',
    '.k......k.',
    '..........',
    '..........',
    '..........',
  ],
  scale: [
    '........',
    '.kkkkkk.',
    'kwwwwwwk',
    'kwwrwwwk',
    'kwwwrwwk',
    'kwwwwwwk',
    '.kkkkkk.',
    '........',
  ],
  call: [
    '....k...',
    '...kk..k',
    'kkkwk.k.',
    'kwwwk..k',
    'kwwwk.k.',
    'kkkwk..k',
    '...kk...',
    '....k...',
  ],
  star: [
    '...kk...',
    '..kyyk..',
    'kkkyykkk',
    'kyyyyyyk',
    '.kyyyyk.',
    '.kykkyk.',
    'kyk..kyk',
    'kk....kk',
  ],
};
ICONS.bone = ICONS.chew;

export function drawIcon(ctx, name, x, y, scale = 1) {
  ICONS[name].forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = KEY[ch];
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    });
  });
}

// Tiny 5×5 emotes shown in a speech bubble over a dog's head.
const EMOTES = {
  heart: ['rr.rr', 'rrrrr', 'rrrrr', '.rrr.', '..r..'],
  bang: ['..k..', '..k..', '..k..', '.....', '..k..'],
  note: ['..kk.', '..k.k', '..k..', 'kkk..', 'kk...'],
  zzz: ['kkkk.', '..k..', '.k...', 'kkkk.', '.....'],
  star: ['..o..', '.ooo.', 'ooooo', '.o.o.', 'o...o'],
  drop: ['..c..', '.ccc.', 'ccccc', 'ccwcc', '.ccc.'],
};

export function drawEmote(ctx, name, x, y) {
  const rows = EMOTES[name];
  if (!rows) return;
  ctx.fillStyle = C.navy;
  ctx.fillRect(x - 1, y - 1, 9, 9);
  ctx.fillRect(x + 1, y + 8, 2, 1);
  ctx.fillRect(x + 1, y + 9, 1, 1);
  ctx.fillStyle = C.cream;
  ctx.fillRect(x, y, 7, 7);
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = KEY[ch];
      ctx.fillRect(x + 1 + i, y + 1 + j, 1, 1);
    });
  });
}

// ---------------------------------------------------------------------------
// Turning sprites into <img> sources (cached)
// ---------------------------------------------------------------------------

const urlCache = new Map();

function toURL(key, width, height, draw) {
  if (!urlCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'));
    urlCache.set(key, canvas.toDataURL());
  }
  return urlCache.get(key);
}

export const iconURL = (name) =>
  toURL(`icon:${name}`, ICONS[name][0].length, ICONS[name].length, (ctx) => drawIcon(ctx, name, 0, 0));

/** A sitting dog on a sunny tile, used when a dog has no photo. */
export const dogTileURL = (coatId, size = 'regular') =>
  toURL(`dogtile:${coatId}:${size}`, 24, 24, (ctx) => {
    ctx.fillStyle = C.sky3;
    ctx.fillRect(0, 0, 24, 24);
    ctx.fillStyle = C.green;
    ctx.fillRect(0, 18, 24, 6);
    ctx.fillStyle = C.leaf;
    for (let x = 1; x < 24; x += 4) ctx.fillRect(x, 18, 1, 1);
    drawDog(ctx, 3, 6, coatId, 'sit', 0, false, size);
  });

export const dogSpriteURL = (coatId, pose, frame = 0, size = 'regular') =>
  toURL(`dog:${coatId}:${pose}:${frame}:${size}`, 20, 20, (ctx) => drawDog(ctx, 1, 5, coatId, pose, frame, false, size));

/** Shrinks a photo to a chunky 28×28 pixel portrait with a limited color range. */
export function pixelatePhoto(dataURL, size = 28) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      const pixels = ctx.getImageData(0, 0, size, size);
      const levels = 5; // 5 shades per channel ≈ 125 colors: reads as retro without losing the dog
      const step = 255 / (levels - 1);
      for (let i = 0; i < pixels.data.length; i += 4) {
        for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.round(pixels.data[i + c] / step) * step;
      }
      ctx.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => reject(new Error("Couldn't read that photo"));
    img.src = dataURL;
  });
}
