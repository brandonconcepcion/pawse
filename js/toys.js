// Toys as chunky "2D but 3D" pixel sprites. Each toy is a tiny 3D model (balls, capsules, boxes...)
// that gets ray-marched into a 32×32 sprite with stepped, dithered shading, a navy outline, and a
// shadow on the shelf. Because they're real 3D shapes, the same toy can be shown from any angle
// (the toy detail sheet spins them like a turntable).

import { C } from './pixel.js';

export const SPRITE = 32; // sprite width & height in pixels
export const FRAMES = 24; // angles in a full turn (15° each)
const FLOOR_ROW = 25; // sprite row where the middle of the shelf (the model's origin) lands
const SHELF_DEPTH = 6; // shadows only land on the shelf top: |z| <= this

// ---------------------------------------------------------------------------
// Colors: each is a ramp of [darkest, shade, base, light]
// ---------------------------------------------------------------------------

export const TOY_COLORS = {
  red: { label: 'Red', ramp: [C.plum, C.crimson, C.red, C.coral] },
  orange: { label: 'Orange', ramp: [C.rust, C.tangerine, C.orange, C.peach] },
  yellow: { label: 'Yellow', ramp: [C.brown, C.orange, C.yellow, C.butter] },
  lime: { label: 'Lime', ramp: [C.forest, C.leaf, C.lime, C.butter] },
  green: { label: 'Green', ramp: [C.teal, C.forest, C.green, C.lime] },
  blue: { label: 'Blue', ramp: [C.navy, C.cobalt, C.blue, C.sky3] },
  purple: { label: 'Purple', ramp: [C.darkPlum, C.grape, C.lavender, C.silver] },
  pink: { label: 'Pink', ramp: [C.plum, C.crimson, C.pink, C.salmon] },
  brown: { label: 'Brown', ramp: [C.darkBrown, C.rust, C.brown, C.salmon] },
  tan: { label: 'Tan', ramp: [C.mauve, C.taupe, C.peach, C.cream] },
  white: { label: 'White', ramp: [C.slate, C.silver, C.cream, '#FFFFFF'] },
  gray: { label: 'Gray', ramp: [C.navy, C.slate, C.silver, C.cream] },
  black: { label: 'Black', ramp: [C.black, C.midnight, C.navy, C.slate] },
};

// Not user-pickable: eyes/noses, the soft brown of plush fur, eyelashes, and a deep royal blue.
const RAMPS = {
  ...Object.fromEntries(Object.entries(TOY_COLORS).map(([id, c]) => [id, c.ramp])),
  ink: [C.black, C.black, C.black, C.mauve],
  fur: [C.darkBrown, C.rust, C.brown, C.tan],
  lash: [C.black, C.black, C.black, C.black], // eyelashes stay solid black even in the light
  royal: [C.navy, C.cobalt, C.cobalt, C.blue], // a deeper blue than the pickable one (the Pup Light can), still lit at the edges
  flame: [C.rust, C.brown, C.tangerine, C.coral], // the Chuckit! ball's red-orange
  aqua: [C.cobalt, C.blue, C.sky3, C.sky4], // its light blue seam
};

// ---------------------------------------------------------------------------
// Shapes (signed distance functions, in pixels; y is up, z points at the viewer)
// ---------------------------------------------------------------------------

const sphere = (cx, cy, cz, r, mat) => ({
  mat,
  d: (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r,
});

const ellipsoid = (cx, cy, cz, rx, ry, rz, mat) => ({
  mat,
  d: (x, y, z) => {
    const px = x - cx;
    const py = y - cy;
    const pz = z - cz;
    const k0 = Math.hypot(px / rx, py / ry, pz / rz);
    const k1 = Math.hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
    return k1 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  },
});

const capsule = (ax, ay, az, bx, by, bz, r, mat) => {
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const len2 = bax * bax + bay * bay + baz * baz;
  return {
    mat,
    d: (x, y, z) => {
      const pax = x - ax;
      const pay = y - ay;
      const paz = z - az;
      const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / len2));
      return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
    },
  };
};

const roundBox = (cx, cy, cz, hx, hy, hz, round, mat) => ({
  mat,
  d: (x, y, z) => {
    const qx = Math.abs(x - cx) - hx + round;
    const qy = Math.abs(y - cy) - hy + round;
    const qz = Math.abs(z - cz) - hz + round;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round;
  },
});

/** A rounded puck standing upright (axis = y). */
const disc = (cx, cy, cz, r, halfHeight, round, mat) => ({
  mat,
  d: (x, y, z) => {
    const dx = Math.hypot(x - cx, z - cz) - r + round;
    const dy = Math.abs(y - cy) - halfHeight + round;
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - round;
  },
});

/** A ring lying flat (axis = y). */
const torus = (cx, cy, cz, ringRadius, tubeRadius, mat) => ({
  mat,
  d: (x, y, z) => Math.hypot(Math.hypot(x - cx, z - cz) - ringRadius, y - cy) - tubeRadius,
});

/** Tips a shape forward (toward the viewer) by `angle` around a pivot. Paint sees the untipped point. */
function tipped(shape, angle, py, pz) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local = (x, y, z) => [x, py + (y - py) * cos + (z - pz) * sin, pz - (y - py) * sin + (z - pz) * cos];
  return {
    mat: typeof shape.mat === 'function' ? (x, y, z) => shape.mat(...local(x, y, z)) : shape.mat,
    d: (x, y, z) => shape.d(...local(x, y, z)),
  };
}

/** Lumpy surface for fluffy fur (a gentle wobble on the distance). */
function fuzzy(shape, amount = 0.35) {
  return {
    mat: shape.mat,
    d: (x, y, z) => shape.d(x, y, z) + amount * Math.sin(x * 2.7) * Math.sin(y * 2.9) * Math.sin(z * 3.1),
  };
}

/** A puffy pillow in the shape of a rounded triangle (a, b, c are [x, y] corners), standing upright. */
function pillowTriangle(a, b, c, corner, puff, mat) {
  const seg = (px, py, [ax, ay], [bx, by]) => {
    const ex = bx - ax;
    const ey = by - ay;
    const h = Math.min(1, Math.max(0, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
    return Math.hypot(px - ax - ex * h, py - ay - ey * h);
  };
  // Which side of each edge the point is on tells us if it's inside the triangle.
  const side = (px, py, [ax, ay], [bx, by]) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const inside = (px, py) => {
    const s1 = side(px, py, a, b);
    const s2 = side(px, py, b, c);
    const s3 = side(px, py, c, a);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  };
  return {
    mat,
    d: (x, y, z) => {
      const edge = Math.min(seg(x, y, a, b), seg(x, y, b, c), seg(x, y, c, a));
      const flat = (inside(x, y) ? -edge : edge) - corner; // rounded outline, negative inside
      const half = puff * Math.min(1, Math.max(0.25, -flat / 5)); // thicker in the middle, thin at the rim
      const qx = flat + 1.2;
      const qz = Math.abs(z) - half + 1.2;
      return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 1.2;
    },
  };
}

/** The same shape made `k` times bigger around a point (the origin by default, so it still sits on the shelf). */
function scaled(shape, k, cx = 0, cy = 0, cz = 0) {
  const local = (x, y, z) => [cx + (x - cx) / k, cy + (y - cy) / k, cz + (z - cz) / k];
  return {
    mat: typeof shape.mat === 'function' ? (x, y, z) => shape.mat(...local(x, y, z)) : shape.mat,
    d: (x, y, z) => shape.d(...local(x, y, z)) * k,
  };
}

/** Alternating bands: twisted rope, stripes. */
const band = (value, a, b) => ((Math.floor(value) % 2) + 2) % 2 ? a : b;

// ---------------------------------------------------------------------------
// Models: one per toy type. `color` is the main color id; `face` turns the model so its
// good side faces you; `gloss` adds a shiny highlight.
// ---------------------------------------------------------------------------

const accent = (color, wanted, fallback) => (color === wanted ? fallback : wanted);

export const MODELS = {
  // Tennis ball with a white seam.
  ball: (color) => {
    const r = 7.5;
    const seam = (x, y, z) => {
      const ny = (y - r) / r;
      return Math.abs(ny - 0.55 * Math.cos(2 * Math.atan2(z, x))) < 0.14 ? 'white' : color;
    };
    return { gloss: true, parts: [sphere(0, r, 0, r, seam)] };
  },

  // Two-tone twisted tug rope with knots and frayed ends.
  rope: (color) => {
    const other = accent(color, 'white', 'tan');
    const twist = (x, y, z) => band(x * 0.6 + Math.atan2(z, y - 3) * (2 / Math.PI), color, other);
    return {
      face: 2,
      parts: [
        capsule(-6.5, 3, 0, -2.2, 3, 1.4, 2.4, twist),
        capsule(-2.2, 3, 1.4, 2.2, 3, 1.4, 2.4, twist),
        capsule(2.2, 3, 1.4, 6.5, 3, 0, 2.4, twist),
        sphere(-7.3, 3.6, 0, 3.5, twist),
        sphere(7.3, 3.6, 0, 3.5, twist),
        capsule(-9.6, 3.5, 0, -11.3, 1, 1.2, 1, other),
        capsule(-9.6, 3.5, 0, -11.6, 1, -1.3, 1, other),
        capsule(9.6, 3.5, 0, 11.3, 1, 1.2, 1, other),
        capsule(9.6, 3.5, 0, 11.6, 1, -1.3, 1, other),
      ],
    };
  },

  // Rubber duck.
  squeaky: (color) => {
    const beak = accent(color, 'orange', 'red');
    return {
      gloss: true,
      face: 4,
      parts: [
        ellipsoid(-1, 5.5, 0, 8, 5.5, 6, color),
        ellipsoid(-7.5, 8.5, 0, 2.6, 3.2, 2.6, color),
        ellipsoid(-1, 7, 5.4, 4.2, 2.6, 1.5, color),
        ellipsoid(-1, 7, -5.4, 4.2, 2.6, 1.5, color),
        sphere(4.5, 12.5, 0, 4.6, color),
        ellipsoid(9.2, 11.6, 0, 2.6, 1.2, 2.2, beak),
        sphere(7.4, 14, 2.6, 0.95, 'ink'),
        sphere(7.4, 14, -2.6, 0.95, 'ink'),
      ],
    };
  },

  // Sitting teddy bear.
  plush: (color) => {
    const muzzle = accent(color, 'tan', 'white');
    return {
      parts: [
        ellipsoid(0, 6.5, 0, 5.5, 6, 4.8, color),
        ellipsoid(0, 6.5, 2.6, 3.4, 3.8, 2.6, muzzle),
        sphere(0, 15.5, 0.5, 5, color),
        sphere(-4.2, 19.6, 0, 2, color),
        sphere(4.2, 19.6, 0, 2, color),
        ellipsoid(0, 14.3, 5, 2.5, 1.9, 1.6, muzzle),
        sphere(0, 15.2, 6.4, 0.95, 'ink'),
        sphere(-1.9, 17, 4.6, 0.8, 'ink'),
        sphere(1.9, 17, 4.6, 0.8, 'ink'),
        capsule(-4.6, 9.5, 1, -6.3, 4.8, 3.2, 1.9, color),
        capsule(4.6, 9.5, 1, 6.3, 4.8, 3.2, 1.9, color),
        ellipsoid(-3, 2.2, 3.6, 2.3, 2.2, 3, color),
        ellipsoid(3, 2.2, 3.6, 2.3, 2.2, 3, color),
      ],
    };
  },

  // Chew bone.
  chew: (color) => ({
    face: 3,
    parts: [
      capsule(-7, 2.6, 0, 7, 2.6, 0, 2.3, color),
      sphere(-8.5, 3, 2.3, 3, color),
      sphere(-8.5, 3, -2.3, 3, color),
      sphere(8.5, 3, 2.3, 3, color),
      sphere(8.5, 3, -2.3, 3, color),
    ],
  }),

  // Frisbee leaning back against the wall.
  frisbee: (color) => {
    const ring = accent(color, 'white', 'yellow');
    const top = (x, y, z) => (Math.abs(Math.hypot(x, z) - 5.5) < 0.9 ? ring : color);
    const tilt = 1.15;
    return {
      gloss: true,
      parts: [
        tipped(disc(0, 10.5, -2, 9.5, 0.9, 0.6, top), tilt, 10.5, -2),
        tipped(torus(0, 10.5, -2, 9.2, 1.3, color), tilt, 10.5, -2),
      ],
    };
  },

  // Stuffable rubber chew toy (the classic snowman shape) with a treat hole.
  puzzle: (color) => ({
    gloss: true,
    parts: [
      ellipsoid(0, 4.6, 0, 6.6, 4.8, 6.6, color),
      ellipsoid(0, 10.6, 0, 5, 3.6, 5, color),
      ellipsoid(0, 15, 0, 3.4, 2.8, 3.4, color),
    ],
    cuts: [disc(0, 17.5, 0, 1.4, 3, 0, color)],
  }),

  // Mystery gift box.
  other: (color) => {
    const ribbon = accent(color, 'yellow', 'red');
    const wrap = (x, y, z) => (Math.abs(x) < 1.4 || Math.abs(z) < 1.4 ? ribbon : color);
    return {
      face: 2,
      parts: [
        roundBox(0, 6, 0, 6.5, 6, 6.5, 0.8, wrap),
        ellipsoid(-2.4, 13, 0, 2.6, 1.7, 1.3, ribbon),
        ellipsoid(2.4, 13, 0, 2.6, 1.7, 1.3, ribbon),
        sphere(0, 12.6, 0, 1.3, ribbon),
      ],
    };
  },

  // ---- Custom toys recreated from the owner's photos ----

  // Teddy's brown bear in a Fair Isle sweater (red, with a navy band of white hearts and a white band of red
  // ones) and a fluffy white hat with a red & navy stripe and a pom-pom, tipped over his right ear.
  // `color` recolors the sweater.
  'sweater-bear': (color) => {
    // Knitted bands, bottom to top: red, white with red hearts, red, navy with white hearts, red.
    const knit = (x, y, z) => {
      const hearts = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 7)) % 2 === 0;
      if (y < 3.0) return color;
      if (y < 4.7) return hearts && y > 3.5 && y < 4.2 ? color : 'white';
      if (y < 5.8) return color;
      if (y < 8.2) return hearts && y > 6.5 && y < 7.5 ? 'white' : 'black';
      return color;
    };
    const sleeve = (x) => (Math.abs(x) > 7.2 ? 'fur' : Math.abs(x) > 5.3 && Math.abs(x) < 6.3 ? 'black' : color);
    const hatBand = (x, y) => (y < 17.5 ? color : 'black');
    return {
      face: 1, // a slight turn so both eyes show
      parts: [
        capsule(-2.1, 1.7, 1, -2.4, 1.6, 4.8, 1.7, 'fur'),
        capsule(2.1, 1.7, 1, 2.4, 1.6, 4.8, 1.7, 'fur'),
        ellipsoid(0, 6.2, 0, 4.3, 4.4, 3.8, knit),
        capsule(-3.4, 8.6, 0.3, -8.4, 7, 1, 1.4, sleeve),
        capsule(3.4, 8.6, 0.3, 8.4, 7, 1, 1.4, sleeve),
        ellipsoid(0, 10.2, 0, 2.4, 0.8, 2, color),
        ellipsoid(0, 14.2, 0.4, 4.5, 4.6, 4, 'fur'),
        ellipsoid(0, 12.6, 3.6, 2.2, 2.4, 1.8, 'tan'),
        ellipsoid(0, 13.4, 5.3, 1.1, 0.8, 0.7, 'ink'),
        sphere(-1.9, 15.7, 3.9, 0.55, 'ink'),
        sphere(1.9, 15.7, 3.9, 0.55, 'ink'),
        sphere(3.6, 18.2, 0, 1.5, 'fur'),
        ellipsoid(-1.3, 17.6, -0.2, 3.6, 0.9, 3.5, hatBand),
        fuzzy(ellipsoid(-1.5, 19, -0.3, 3.4, 2, 3.2, 'white')),
        fuzzy(sphere(-3.2, 21, -0.6, 1.5, 'white')),
      ],
    };
  },

  // A big plush nacho-cheese tortilla chip (a giant dog-toy Dorito): a puffy triangle, cheesy orange with lighter
  // yellow patches, a reddish toasted band, and a few dark brown specks (positions taken from the photo).
  'nacho-chip': (color) => {
    const specks = [[-1.5, 19.6], [0.2, 19.2], [-0.8, 17.8], [0.8, 17.2], [-5.2, 13.9], [-3, 14.1], [6.2, 10.2], [-6.7, 4.3]];
    const toasted = (x, y, z) => {
      const side = z < 0 ? -x : x; // the back gets the same pattern, mirrored
      if (specks.some(([sx, sy]) => Math.hypot(side - sx, y - sy) < 0.85)) return 'brown';
      if (y > 8.5 && y < 10 && Math.sin(side * 0.7 + y) > 0.2) return 'red'; // the darker toasted band
      return Math.sin(side * 0.45 + 0.5) * Math.sin(y * 0.5 + 1) > 0.5 ? 'yellow' : color;
    };
    return {
      face: 1,
      parts: [fuzzy(pillowTriangle([-9.5, 2], [10, 2.5], [-0.8, 20.5], 2, 2.6, toasted), 0.15)],
    };
  },

  // Fuzzyard "Silver Dogquila": a plush tequila bottle. Silver-cream body with a black label (white trim, "Dogquila"
  // text, 20 / dog / 03), a little "slobber responsibly" tag, a white neck with a black band, and a peach cork.
  // `color` recolors the body. At this size the writing becomes rows of white dashes.
  dogquila: (color) => {
    // Dashes that read as lettering: on where the pattern is high, off in the gaps.
    const dashes = (x, gap) => Math.floor(x * 1.3) % gap !== 0;
    // Distance to a rounded rectangle (half sizes hx, hy; corner radius r), negative inside.
    const rounded = (x, y, hx, hy, r) => {
      const qx = Math.abs(x) - hx + r;
      const qy = Math.abs(y) - hy + r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    };
    const body = (x, y, z) => {
      if (z < 1.5) return color; // the label is on the front only
      if (y > 11.7 && Math.abs(x) < 3) return y > 12.1 && y < 12.7 && dashes(x, 3) ? 'white' : 'ink'; // tag
      if (y > 1 && y < 1.9 && Math.abs(x) < 5.6) return dashes(x, 2) ? 'ink' : color; // text along the bottom
      const edge = rounded(x, y - 7, 5.6, 4.4, 2.4); // the label is a rounded rectangle too
      if (edge > 0) return color;
      if (edge > -0.8) return 'gray'; // the label's trim
      if (y > 9.8) return Math.abs(x) < 2.2 && dashes(x, 3) ? 'white' : 'ink'; // SILVER
      if (y > 8.3 && y < 9.5) return Math.abs(x) < 4.4 && dashes(x, 3) ? 'white' : 'ink'; // Dogquila
      if (y > 5.6 && y < 7.8) {
        if (Math.abs(x) > 2.8 && Math.abs(x) < 4.8) return dashes(x, 2) ? 'white' : 'ink'; // 20 and 03
        const dog = Math.abs(x) < 1.8 && ((y > 6.4 && y < 7.2) || (x > 0.6 && y > 7.2) || (y < 6.5 && Math.abs(x) > 0.9));
        return dog ? 'white' : 'ink';
      }
      if (y > 3.8 && y < 4.7 && Math.abs(x) < 4.2) return dashes(x, 2) ? 'gray' : 'ink'; // small print
      return 'ink';
    };
    const neck = (x, y, z) => {
      if (y < 17.3 || y > 19.3) return 'white'; // the band sits high, just under the collar
      return z > 1 && y > 18 && y < 18.6 && dashes(x, 2) ? 'white' : 'ink'; // the FUZZYARD 2003 band
    };
    return {
      parts: [
        // A fat pillow: big rounded corners in front view, soft round edges in depth.
        fuzzy({
          mat: body,
          d: (x, y, z) => {
            const flat = rounded(x, y - 6.8, 7.8, 6.8, 5);
            const qz = Math.abs(z) - 0.6;
            return Math.hypot(Math.max(flat + 3.4, 0), Math.max(qz, 0)) + Math.min(Math.max(flat + 3.4, qz), 0) - 3.4;
          },
        }, 0.18),
        // A long, narrow neck on small shoulders, so the round body and the top read as separate pieces.
        fuzzy(ellipsoid(0, 13.5, 0, 3.4, 1.2, 2.4, 'white'), 0.12),
        disc(0, 16.6, 0, 2.2, 3, 0.6, neck),
        fuzzy(disc(0, 19.9, 0, 2.6, 0.7, 0.4, 'white'), 0.12),
        fuzzy(ellipsoid(0, 22.2, 0, 3, 2, 3, 'tan'), 0.2),
      ],
    };
  },

  // Multipet's Lamb Chop: a big plush lamb lying flat. Cream fleece, a big head with a smooth white muzzle, black
  // lash eyes, a red smile, floppy peach ears, front legs stretched forward with red hooves, back legs stretched out
  // behind, and a little tail. It's long, so it takes two shelf slots (`span: 2`). `color` recolors the fleece.
  'lamb-chop': (color) => {
    const hoof = accent(color, 'red', 'pink');
    // Closed eyes with a fringe of black lashes, painted onto the face: a lid line, and lash spikes fanning up from it.
    const lashes = (base) => (x, y, z) => {
      if (z < 5) return base;
      for (const [ex, out] of [[-15.1, -1], [-8.9, 1]]) {
        const dx = x - ex;
        const lid = y - 10.8 + 0.12 * dx * dx; // 0 along the lid, which curves down at the ends
        if (Math.abs(dx) < 2.2 && Math.abs(lid) < 0.45) return 'lash'; // the lid line
        if (Math.abs(dx) < 2 && lid > 0.45 && lid < 1.5 && Math.floor(dx * 1.2 + 10) % 2 === 0) return 'lash'; // short fringe
        if (dx * out > 1.9 && dx * out < 2.9 && lid > -0.1 && lid < 1.1) return 'lash'; // the lashes flick out at the corner
      }
      return base;
    };
    // The head is a big part of the real toy, so the whole head (face and ears too) is grown 1.12× from its chin,
    // and tipped back a little from the neck so the face looks up and out, like the photo.
    const head = [
      fuzzy(sphere(-12, 9.6, 1.8, 7.6, lashes(color)), 0.3),
      ellipsoid(-12, 7.4, 7.2, 4.2, 3.7, 3, lashes('white')), // smooth muzzle (no fuzz, so it reads apart from the fleece)
      sphere(-12, 9.2, 9.7, 0.5, 'brown'), // the stitched nose
      ellipsoid(-12, 5.4, 9.6, 2.4, 0.85, 1.2, 'red'), // the red tongue, poking out under the muzzle
      capsule(-18.6, 11.6, 1.8, -21.8, 13.6, 2.6, 1.7, 'tan'), // ears, sticking up and out
      capsule(-5.4, 11.6, 1.8, -2.2, 13.6, 2.6, 1.7, 'tan'),
    ].map((part) => scaled(tipped(part, -0.3, 3, 1.8), 1.12, -11, 2, 1.8));
    const parts = [
      fuzzy(ellipsoid(4, 5.4, -0.5, 13.5, 5.4, 6.6, color), 0.3), // a plump body
      fuzzy(capsule(14, 3, 2.2, 20.5, 2.4, 2.8, 2.4, color), 0.25), // back legs, stretched out behind
      fuzzy(capsule(14, 3, -2.6, 20.5, 2.4, -3, 2.4, color), 0.25),
      fuzzy(sphere(16.5, 10, -1, 1.9, color), 0.3), // tail
      fuzzy(capsule(-9, 2.6, 1.5, -18, 2.3, 4, 2.4, color), 0.25), // front legs, reaching forward
      fuzzy(capsule(-6, 2.6, 2.5, -9, 2.3, 5.2, 2.4, color), 0.25),
      ellipsoid(-19.6, 2.3, 4.4, 2.8, 2.3, 2.5, hoof),
      ellipsoid(-9.6, 2.3, 5.8, 2.6, 2.3, 2.3, hoof),
      ...head,
    ];
    // Drawn at a comfortable size, then scaled up so it fills its two slots (shifted right a touch to stay centered).
    return { span: 2, parts: parts.map((part) => scaled(part, 1.12, -1)) };
  },

  // Nestpark's "Pup Light" plush beer can: royal blue with a lighter blue top band, a dark diamond crest with a white
  // paw print, big white PUP LIGHT lettering over two white lines, and soft gray rims. At this size the letters become
  // rows of white blocks. `color` recolors the can (the default blue uses the deeper royal ramp, like the real one).
  'pup-light': (color) => {
    const can = color === 'blue' ? 'royal' : color;
    const band = color === 'blue' ? 'blue' : accent(color, 'white', 'gray');
    // Blocky letters: `count` letters across `half` either side of the middle, with a one-pixel gap between them.
    const letters = (x, count, half) => Math.abs(x) < half && Math.floor(((x + half) / (2 * half)) * count * 4) % 4 !== 3;
    const label = (x, y, z) => {
      if (y < 1.5 || y > 19.6) return 'gray'; // the rims
      const side = z < 0 ? -x : x; // the back is printed the same, so it reads when it spins
      const front = Math.abs(z) > 2.2;
      if (y > 13) {
        if (front && Math.abs(side) + Math.abs(y - 16.2) < 2.8) {
          const paw = Math.hypot(side, y - 15.5) < 0.95 || [[-1, 17], [0, 17.5], [1, 17]].some(([px, py]) => Math.hypot(side - px, y - py) < 0.5);
          return paw ? 'white' : 'royal'; // the crest
        }
        return y < 13.6 ? 'royal' : band; // the light top band, edged in dark blue
      }
      if (!front) return can;
      if (y > 10.4 && y < 12.6 && letters(side, 3, 3.2)) return 'white'; // PUP
      if (y > 7.6 && y < 9.8 && letters(side, 5, 4.5)) return 'white'; // LIGHT
      if (Math.abs(side) < 4.2 && ((y > 6 && y < 6.6) || (y > 4.7 && y < 5.3))) return 'white'; // the two lines
      return can;
    };
    return {
      parts: [disc(0, 10.6, 0, 5.7, 10.1, 1.7, label)], // a plush can, kept slender (smooth, so the print stays crisp)
    };
  },

  // Nestpark's "Pups Blue Rubbin" plush beer can (a Pabst Blue Ribbon parody): a white can with a red sash winding
  // around it, a big blue circle with a white "Pups" and paw, a blue BLUE RUBBIN banner across it, two blue bones, a blue
  // wreath, a thin red line near the bottom, and soft gray rims. Same can shape as the Pup Light, so they look like a
  // pair. `color` recolors the can (the blue print turns white on a blue can).
  'blue-rubbin': (color) => {
    const ink = color === 'blue' ? 'white' : 'royal';
    const sash = accent(color, 'red', 'royal');
    // Lettering this small becomes a dashed white line: one pixel of letter, one of gap.
    const dashes = (x, half, shift = 0) => Math.abs(x) < half && Math.floor(x + 20 + shift) % 2 === 0;
    const label = (x, y, z) => {
      if (y < 1.5 || y > 19.6) return 'gray'; // the rims
      const side = z < 0 ? -x : x; // the back is printed the same, so it reads when it spins
      const front = Math.abs(z) > 2.2;
      if (front) {
        if (y > 10.6 && y < 13.8 && Math.abs(side) < 5.6) {
          return y > 11.6 && y < 12.9 && dashes(side, 4.4) ? 'white' : ink; // the BLUE RUBBIN banner
        }
        if (Math.hypot(side, y - 13.2) < 4.8) {
          if (y > 15 && y < 16.3 && dashes(side, 2.4, 1)) return 'white'; // "Pups" (staggered, so the letters don't line up)
          if (Math.hypot(side, y - 9.6) < 1.2) return 'white'; // the paw pad peeking out under the banner
          return ink; // the big circle
        }
        if (y > 5.8 && y < 7.4 && Math.abs(Math.abs(side) - 2.4) < 1.6) return ink; // two bones
        if (y > 4 && y < 5 && Math.abs(side) < 4.4 && Math.floor(side + 10) % 2 === 0) return ink; // the wreath
      }
      if (y > 2.2 && y < 2.8) return sash; // the thin red line near the bottom
      if (Math.abs(y - 11.5 + 1.1 * side) < 1.3) return sash; // the red sash, winding behind the circle
      return color;
    };
    return {
      parts: [disc(0, 10.6, 0, 5.7, 10.1, 1.7, label)],
    };
  },

  // Chuckit! ball launcher and its ball, as two separate pieces across two shelf slots: the blue launcher lies on its
  // side at full length (cup, gently curved handle, and the flat hand grip with its slot), its empty cup facing you, next
  // to the red-orange ball (light blue seam, white "Chuckit!" patch). `color` recolors the launcher
  // (the default blue is the deeper royal blue of the real one).
  chuckit: (color) => {
    const plastic = color === 'blue' ? 'royal' : color;
    const [bx, by, bz, br] = [-21.5, 5.2, 1, 5.2]; // the ball
    const ball = (x, y, z) => {
      const nx = (x - bx) / br;
      const ny = (y - by) / br;
      const nz = (z - bz) / br;
      if (nx * 0.15 + ny * 0.3 + nz * 0.94 > 0.86 && Math.abs(ny - 0.3) < 0.2) return 'white'; // the logo, facing you
      return Math.abs(ny - 0.5 * Math.cos(2 * Math.atan2(nz, nx) + 1.4)) < 0.17 ? 'aqua' : 'flame';
    };
    // The cup: a ball-sized shell lying on its side, open toward you (and a little toward the ball), like the photo.
    const [cx, cy, cz, cr] = [-8.5, 5.35, 0, 4.6];
    const open = [-0.45, 0.3, 0.85];
    const cup = {
      mat: plastic,
      d: (x, y, z) => {
        const shell = Math.abs(Math.hypot(x - cx, y - cy, z - cz) - cr) - 0.75;
        const front = (x - cx) * open[0] + (y - cy) * open[1] + (z - cz) * open[2] - 0.3 * cr;
        return Math.max(shell, front);
      },
    };
    return {
      span: 2,
      parts: [
        sphere(bx, by, bz, br, ball),
        cup,
        capsule(-4.2, 4.6, 0, 4, 2.4, 0, 0.95, plastic), // the handle, curving down from the cup...
        capsule(4, 2.4, 0, 18, 1.8, 0, 0.95, plastic), // ...to lie along the shelf
        ellipsoid(21.8, 2.7, 0, 4.4, 2.7, 0.9, plastic), // the flat grip, on its edge so you see the slot
      ],
      cuts: [ellipsoid(22.6, 2.9, 0, 2.6, 1, 2, plastic)], // the slot in the grip
    };
  },

  // A comically giant tennis ball (an inflatable one, big enough for a golden retriever to rest his chin on): fuzzy
  // yellow-green felt with the white seam, so big it takes two shelf slots. Same seam as the normal `ball`.
  'giant-ball': (color) => {
    const r = 12.6;
    const seam = (x, y, z) => {
      const ny = (y - r) / r;
      return Math.abs(ny - 0.55 * Math.cos(2 * Math.atan2(z, x) + 3.6)) < 0.11 ? 'white' : color; // the S-curve faces you
    };
    return { span: 2, parts: [fuzzy(sphere(0, r, 0, r, seam), 0.12)] };
  },
};

export const DEFAULT_COLOR = {
  ball: 'lime', rope: 'blue', squeaky: 'yellow', plush: 'brown',
  chew: 'tan', frisbee: 'orange', puzzle: 'red', other: 'pink',
  'sweater-bear': 'red', 'nacho-chip': 'orange', dogquila: 'gray', 'lamb-chop': 'white', 'pup-light': 'blue',
  'blue-rubbin': 'white', chuckit: 'blue',
  'giant-ball': 'lime',
};

/** The model and color a saved toy uses. */
export function toyLook(toy) {
  const kind = MODELS[toy?.kind] ? toy.kind : 'other';
  const color = TOY_COLORS[toy?.color] ? toy.color : DEFAULT_COLOR[kind];
  return { kind, color };
}

// ---------------------------------------------------------------------------
// Ray marcher
// ---------------------------------------------------------------------------

const PITCH = 0.5; // camera looks down ~29°
const SIN_P = Math.sin(PITCH);
const COS_P = Math.cos(PITCH);
const norm = (x, y, z) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
const LIGHT = norm(-0.55, 0.9, 0.5); // from the top left, a little in front
const HALF = norm(LIGHT[0], LIGHT[1] + SIN_P, LIGHT[2] + COS_P); // for the shiny highlight
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const SHADOW = 'shadow';
const OUTLINE = C.navy;

/**
 * Sprite size for a model. Most toys are SPRITE×SPRITE; a big toy with `span: 2` takes two shelf slots, so it's
 * twice as wide, plus WIDE_PAD_ROWS above and below so its long body still fits when it spins end-on in the viewer
 * (it reaches up when pointing away and down when pointing at you). On the shelf those rows are empty.
 * `top` = rows added above, so the shelf surface lands at FLOOR_ROW + top.
 */
export const WIDE_PAD_ROWS = 8;
export const spriteSize = (model) =>
  (model.span ?? 1) > 1
    ? { w: SPRITE * model.span, h: SPRITE + 2 * WIDE_PAD_ROWS, top: WIDE_PAD_ROWS }
    : { w: SPRITE, h: SPRITE, top: 0 };

/**
 * Renders a model turned by `angle` radians into a grid of colors (spriteSize(model), row by row).
 * Returns an array of hex strings, 'shadow', or null (see-through).
 */
export function rasterize(model, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { parts, cuts = [] } = model;

  // Distance from a world point to the model (the model is turned, the camera isn't).
  const dist = (x, y, z) => {
    const mx = cos * x + sin * z;
    const mz = -sin * x + cos * z;
    let d = Infinity;
    for (const part of parts) d = Math.min(d, part.d(mx, y, mz));
    for (const cut of cuts) d = Math.max(d, -cut.d(mx, y, mz));
    return d;
  };
  const paintAt = (x, y, z) => {
    const mx = cos * x + sin * z;
    const mz = -sin * x + cos * z;
    let best = parts[0];
    let bestD = Infinity;
    for (const part of parts) {
      const d = part.d(mx, y, mz);
      if (d < bestD) {
        bestD = d;
        best = part;
      }
    }
    return typeof best.mat === 'function' ? best.mat(mx, y, mz) : best.mat;
  };

  const { w, h, top } = spriteSize(model);
  const colors = new Array(w * h).fill(null);
  const darks = new Array(w * h).fill(null); // each toy pixel's darkest tone, for inner outlines
  const depth = new Float32Array(w * h).fill(Infinity);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = i + 0.5 - w / 2;
      const sy = FLOOR_ROW + top - (j + 0.5);
      // Orthographic camera: ray starts far in front and travels along the view direction.
      const ox = sx;
      const oy = sy * COS_P + 40 * SIN_P;
      const oz = -sy * SIN_P + 40 * COS_P;
      const dx = 0;
      const dy = -SIN_P;
      const dz = -COS_P;

      let t = 0;
      let hit = false;
      for (let step = 0; step < 80 && t < 90; step++) {
        const d = dist(ox + dx * t, oy + dy * t, oz + dz * t);
        if (d < 0.02) {
          hit = true;
          break;
        }
        t += d;
        if (oy + dy * t < -1) break; // went under the shelf
      }

      const index = j * w + i;
      if (hit) {
        const px = ox + dx * t;
        const py = oy + dy * t;
        const pz = oz + dz * t;
        const e = 0.05;
        const n = norm(
          dist(px + e, py, pz) - dist(px - e, py, pz),
          dist(px, py + e, pz) - dist(px, py - e, pz),
          dist(px, py, pz + e) - dist(px, py, pz - e)
        );
        const diffuse = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        const dither = (BAYER[(j % 4) * 4 + (i % 4)] / 16 - 0.47) * 0.09;
        const light = 0.32 + 0.68 * diffuse + dither;
        const ramp = RAMPS[paintAt(px, py, pz)] ?? RAMPS.white;
        const spec = (n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]) ** 30;
        colors[index] = model.gloss && spec > 0.55 ? C.cream : ramp[light < 0.4 ? 0 : light < 0.62 ? 1 : light < 0.84 ? 2 : 3];
        darks[index] = ramp[0];
        depth[index] = t;
        continue;
      }

      // Missed the toy: does this spot on the shelf sit in its shadow?
      const tf = oy / SIN_P; // where the ray meets the shelf (y = 0)
      const fx = ox;
      const fz = oz + dz * tf;
      if (Math.abs(fz) > SHELF_DEPTH) continue;
      let s = 0.4;
      let shade = 1;
      for (let step = 0; step < 40 && s < 30; step++) {
        const d = dist(fx + LIGHT[0] * s, LIGHT[1] * s, fz + LIGHT[2] * s);
        if (d < 0.02) {
          shade = 0;
          break;
        }
        shade = Math.min(shade, (5 * d) / s);
        s += d;
      }
      // Soft edge = checkerboard dither, like an old console.
      if (shade < 0.35 || (shade < 0.8 && (i + j) % 2 === 0)) colors[index] = SHADOW;
    }
  }

  // Inner outlines: where a surface passes behind a nearer one, use its darkest tone.
  const out = [...colors];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const index = j * w + i;
      if (!darks[index]) continue;
      const nearer = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) return false;
        return depth[nj * w + ni] < depth[index] - 2.5;
      });
      if (nearer) out[index] = darks[index];
    }
  }

  // Outer outline: see-through/shadow pixels touching the toy become navy.
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && depth[j * w + i] < Infinity;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const index = j * w + i;
      if (depth[index] < Infinity) continue;
      if (solid(i + 1, j) || solid(i - 1, j) || solid(i, j + 1) || solid(i, j - 1)) out[index] = OUTLINE;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sprites (cached data URLs)
// ---------------------------------------------------------------------------

const rgbCache = new Map();
const rgb = (hex) => {
  if (!rgbCache.has(hex)) rgbCache.set(hex, [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)));
  return rgbCache.get(hex);
};
const SHADOW_RGBA = [...rgb(C.navy), 90];

const spriteCache = new Map();

/**
 * A toy sprite as a data URL. `frame` is the turn (0..FRAMES-1) on top of the model's
 * own `face`, so frame 0 is its best side.
 */
export function toySpriteURL(toy, frame = 0) {
  const { kind, color } = toyLook(toy);
  const key = `${kind}:${color}:${frame}`;
  if (!spriteCache.has(key)) {
    const model = MODELS[kind](color);
    const turn = (((frame + (model.face ?? 0)) % FRAMES) + FRAMES) % FRAMES;
    const pixels = rasterize(model, (turn / FRAMES) * Math.PI * 2);
    const { w, h } = spriteSize(model);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(w, h);
    pixels.forEach((c, index) => {
      if (!c) return;
      image.data.set(c === SHADOW ? SHADOW_RGBA : [...rgb(c), 255], index * 4);
    });
    ctx.putImageData(image, 0, 0);
    spriteCache.set(key, canvas.toDataURL());
  }
  return spriteCache.get(key);
}

const sizeCache = new Map();
/** A toy's sprite size ({ w, h, top }, see spriteSize). */
export function toySize(toy) {
  const { kind } = toyLook(toy);
  if (!sizeCache.has(kind)) sizeCache.set(kind, spriteSize(MODELS[kind](DEFAULT_COLOR[kind])));
  return sizeCache.get(kind);
}

/** How many shelf slots a toy takes (1, or 2 for a big one). */
export const toySpan = (toy) => toySize(toy).w / SPRITE;

/** A slight, stable turn per toy so a shelf doesn't look like a row of clones. */
export function shelfFrame(toy) {
  if (toySpan(toy) > 1) return 0; // a big toy lies straight along its two slots instead of poking off the shelf
  let hash = 0;
  for (const ch of String(toy.id)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return [-2, -1, 1, 2][Math.abs(hash) % 4];
}

// ---------------------------------------------------------------------------
// The toy room: shelf plank + wallpaper tiles (drawn in the same 3/4 view as the toys)
// ---------------------------------------------------------------------------

/** Sprite row where the shelf's top surface starts (the back edge, z = -SHELF_DEPTH). */
export const SHELF_TOP_ROW = Math.round(FLOOR_ROW - SHELF_DEPTH * SIN_P);

function tileURL(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'));
  return canvas.toDataURL();
}

let plank;
/** 16×14 repeating plank: 6 rows of shelf top, a lit lip, the front face, then its shadow on the wall. */
export function plankURL() {
  plank ??= tileURL(16, 14, (ctx) => {
    const fill = (color, x, y, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    fill(C.rust, 0, 0, 16, 1); // back edge in shade
    fill(C.brown, 0, 1, 16, 5); // top surface
    fill(C.tangerine, 2, 2, 5, 1); // wood grain
    fill(C.tangerine, 10, 4, 4, 1);
    fill(C.salmon, 0, 6, 16, 1); // front lip catching the light
    fill(C.rust, 0, 7, 16, 4); // front face
    fill(C.brown, 4, 8, 6, 1);
    fill(C.brown, 12, 9, 3, 1);
    fill(C.darkBrown, 0, 11, 16, 1); // underside
    ctx.fillStyle = 'rgba(17, 29, 53, 0.45)'; // shadow on the wall
    ctx.fillRect(0, 12, 16, 2);
  });
  return plank;
}

// Portraits for the wall: the dogs' photos shrunk to 28×28, white-balanced and snapped to the palette by
// tools/make-portrait.py (the busy room behind them is faded to teal). One letter per color. Teddy first:
const TEDDY_PORTRAIT = [
  'gggggggggggggggggggggggggggg',
  'gggggggggggggggggggggggggggg',
  'ggggggggssssgngsgggggggggggg',
  'ggggggsltttSlsmtllsggggggggg',
  'gggglstttSWwwcWWWSlsgggggggg',
  'gggstttScwwwwwwwcWSlsggggggg',
  'ggtSttSwwwwwwwcwcWWtlggggggg',
  'gstpttWcwwwcwWWwStttlsgggggg',
  'gmststWWwcttSWwwWsnnsgglgggg',
  'gmmstcScctdmWwwWWWtdnnnlllgg',
  'nmdscctwWWtWwctsmtWtdnnmsllg',
  'nddSwStcWcwwwSddkdtSsddmmssm',
  'nsSwwStcccwcwSmdkdtttmddnnng',
  'glccwStccccccWtddstttsddddng',
  'glScwttWWccWWWtmmstttsdddddn',
  'gslWwttttccWSSsddstttsdddddg',
  'gglSctsstWWWttssmststmkdddmg',
  'gglSStssttSStssssssssdddmmmg',
  'gggtSSttttSSttssssmmmmmmmmgg',
  'llSWWSSSSSWcStssssssssmmmngg',
  'SWwwcWWccWwWWStsttttssmmmngg',
  'cwwwwwwwccWWWStttttttsmmdmng',
  'wwwwwwcwwWWWWStttttttsmmdmmg',
  'wwwwwwccwcWWWSSStttttsddddmg',
  'wwwwwwccccWWWSSttttttsdddmmg',
  'wwwwwwcwccWWStSttttttmdmmmng',
  'wwwwwwwwcWcWStSttttttmmmdkng',
  'wwwwwwwccWWSStttttttsmdkkdng',
];
// Cookie (--box 730,250,1480,1000 --ellipse 375,225,290,230 --ellipse 330,600,300,340 --gamma 0.5 --gains 1.25,1.22,1.14):
const COOKIE_PORTRAIT = [
  'ggggggggsstWSSWWSSllsggggggg',
  'ggggggslSSWcwwwwccWSllgggggg',
  'gggggllSWWccwwwwwwwcWSlggggg',
  'ggggslSWWWcccccwwwwwcWSlgggg',
  'gggslSWWWccWWWWWwwwwwwWlsggg',
  'ggglSppWpcWStSSSSWWwwwcSlggg',
  'ggglSppWWWSsmtSSSsscwwwWlsgg',
  'ggstWppWWWStsSWccllWwwwcSsgg',
  'ggstWppWWWWWWccwwwwcwwwcSlgg',
  'ggstSWWSWWWcccccwwwwwwwcSsgg',
  'ggglSWWWWWcWcWWSWwwwwwwWlggg',
  'gggsSWWWWWWWWWtttWwwwwcSlggg',
  'gggslWWWWWWWWStsstcwwcWlsggg',
  'gggsSWWWWWWWWStttScwwWSlgggg',
  'ggglSWWpWWWWWSSSWcwwcSlggggg',
  'ggstWWpWWWWSSWWWcwwwcSlggggg',
  'ggsSWWpWWWWSSSSSWwwwcSlggggg',
  'gglWWWWWWWWSSSSSWwwwwWSsgggg',
  'gsSWWWWWWWWSSSSSWwwwwcSlgggg',
  'glSWWWWpWWWSSSSSWcwwwwSlgggg',
  'glSWWWWWpWWWSWSSWcwwwwWlgggg',
  'glSWWWWSWSSSWWWWWcwwwwWlgggg',
  'slSWWWWSSSSSSWWWWwwwwcWlgggg',
  'slSSWWSSStSSSSWcwccwwwWlgggg',
  'glSSSWWSSSSSSSWcWWcwwwWlgggg',
  'glStSWWSSStSSScWSScwwcSlgggg',
  'gstttWWSSStSSSWSSScwwcSlgggg',
  'gsttSWWSSSSSSSSSSScwwcSsgggg',
];
const PORTRAIT_COLORS = {
  k: C.black, n: C.navy, s: C.slate, S: C.silver, c: C.cream, w: '#FFFFFF', W: '#DCD3CA', t: C.taupe,
  d: C.darkBrown, m: C.mauve, p: C.peach, l: C.lavender, g: C.teal,
};

let wallpaper;
/** 16×16 repeating wallpaper: teal stripes with little paw prints. */
export function wallpaperURL() {
  wallpaper ??= tileURL(16, 16, (ctx) => {
    ctx.fillStyle = C.teal;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = C.midnight;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, 2, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.forest; // a paw print: pad + three toes
    for (const [x, y, w, h] of [[6, 8, 3, 2], [5, 6, 1, 1], [7, 5, 1, 1], [9, 6, 1, 1]]) ctx.fillRect(x, y, w, h);
  });
  return wallpaper;
}

const portraits = {};
/** 36×36 framed portrait ('teddy' or 'cookie') that hangs on the toy-room wall (placed by the CSS, not tiled). */
export function portraitURL(dog = 'teddy') {
  const photo = dog === 'cookie' ? COOKIE_PORTRAIT : TEDDY_PORTRAIT;
  portraits[dog] ??= tileURL(36, 36, (ctx) => {
    const fill = (color, x, y, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    fill(C.navy, 0, 0, 36, 36); // outline
    fill(C.brown, 1, 1, 34, 34); // wooden frame
    fill(C.tangerine, 1, 1, 34, 1); // lit top edge
    fill(C.rust, 1, 34, 34, 1); // shaded bottom edge
    fill(C.navy, 3, 3, 30, 30); // inner edge
    photo.forEach((row, y) => [...row].forEach((ch, x) => fill(PORTRAIT_COLORS[ch], 4 + x, 4 + y, 1, 1)));
  });
  return portraits[dog];
}
