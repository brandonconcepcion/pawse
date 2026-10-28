# Pixel art: `js/pixel.js`

All art is drawn in code, with no image assets except app icons. Everything renders at 1 unit = 1 pixel and is
scaled up with `image-rendering: pixelated`.

## Palette `C`
PICO-8's 16 colors (`navy`, `red`, `orange`, `yellow`, `green`, `blue`, `pink`, `peach`, `cream`, …) plus extras:
sky tints (`sky2`–`sky4`), grass (`leaf`, `lawn`), and Teddy's `tan` and `cocoa`. `navy` is the universal outline color.

## Dogs

### Poses
`POSES` maps a pose name to `(frame) => ({ bob, rects, details, head, thigh, standing? })`:
- `rects`: `[x, y, w, h, part]` in an **18×14 box facing right**. An outline (navy, 1px) is drawn around the union
  of all rects automatically, then the fills.
- `details`: drawn after fills with no outline (eye, nose, collar, tongue, markings).
- `head`: `[dx, dy]` offset of the head (used to place ears, fluff, and the sweatband); `null` for `roll`.
- `thigh`: where the back-thigh marking goes. `standing`: true for run/walk/sniff/jump (affects shrinking).
- Poses: `run` (4 frames), `walk`, `sniff`, `sit`, `wag`, `lie`, `sleep`, `roll`, `beg`, `bow`, `jump`.

Parts → colors: `body`, `shade`, `light`, `ear`, `eye`, `nose`, `collar`, `tongue`, plus `band` and `marking`.

### `drawDog(ctx, x, y, coatId, pose, frame, flip, size)`
1. Builds colors from the coat (defaults: navy eye/nose, red collar, ear = shade).
2. `coat.fluffy` adds a head tuft + beard rects. `coat.band` adds a sweatband.
3. `coat.markings` (Teddy): **facing right shows the dog's LEFT side** (brown left ear). **Facing left
   (`flip`) shows the RIGHT side**: white ear with a brown stripe + brown thigh spot by the tail.
4. Size: `small`, `chubby`, `plump` → `shrink()` (2px narrower through the middle; standing poses get shorter
   legs, feet stay put). `chubby`/`plump` → `roundOut()` adds a belly/back bulge (level 1/2).
   `chubby` isn't user-selectable; the gym uses it as the halfway point of a diet.
5. `flip` mirrors x within the 18px box.

### Coats (`COATS`)
`golden`, `chocolate`, `black`, `white`, `gray`, `cream`, **`teddy`** (white, warm-grey shading, `tan`
markings, cocoa eyes, black nose, no collar, fluffy), **`cookie`** (white, pale ears, dark-brown nose, pink
sweatband, fluffy, no collar).

To add a coat: add an entry with `label, body, shade, light` and any of `ear, eye, nose, collar, band, marking,
fluffy, markings`. It appears in the dog editor automatically. If it needs new geometry, add a flag and handle it
in `drawDog`.

Sizes (`SIZES`, user-selectable): `regular`, `small`, `plump`.

## Icons & emotes
- `ICONS`: letter grids (`'.'` = transparent; letters map through `KEY` to palette colors). Toy kinds use the
  icon with the same name (`ball`, `rope`, `squeaky`, …; `chew` = `bone`), plus `paw`, `heart`, `log`, `star`,
  `gym` (10×10 dumbbell), `scale`, `call` (speaker). `drawIcon(ctx, name, x, y, scale)`.
- `EMOTES`: 5×5 grids drawn in a speech bubble by `drawEmote(ctx, name, x, y)`: `heart`, `bang` (!), `note`,
  `zzz`, `star`, `drop` (sweat/water).

## `<img>` helpers (cached data URLs)
- `iconURL(name)`: icon at native size.
- `dogTileURL(coat, size)`: 24×24 sitting dog on a sky/grass tile (avatar fallback, tab icon).
- `dogSpriteURL(coat, pose, frame, size)`: 20×20 sprite (editor pickers, celebration, empty states).
- Show these at integer multiples of their size (e.g. a 20px sprite at 60 or 80) to keep pixels square.

## `pixelatePhoto(dataURL)`
Center-crops to a square, downsizes to 28×28, and quantizes each channel to 5 levels for a retro look. The result is
stored as `dog.photoPixel` and used for avatars.
