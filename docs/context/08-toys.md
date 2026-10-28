# Toys: `js/toys.js` + the Toy Wall screen

Each toy is a tiny **3D model** that gets ray-marched into a 32×32 pixel sprite. Because the models are real 3D
shapes, the same toy can be drawn from any angle: the wall turns each toy slightly, and the toy viewer spins it
like a turntable. The result is "2D but 3D": flat pixel art with stepped, dithered shading, a navy outline,
darker inner outlines where one part passes in front of another, and a shadow on the shelf.

## Data

Toys live inside their dog record (`dog.toys`, see [03-data-and-backups.md](03-data-and-backups.md)):

```js
{ id, name, kind, color /* optional, a TOY_COLORS id */, rating /* 1-5 */, notes, createdAt }
```

`toyLook(toy)` → `{ kind, color }`: an unknown kind falls back to `other`, and a missing color falls back to
`DEFAULT_COLOR[kind]` (ball = lime, rope = blue, squeaky = yellow, plush = brown, chew = tan, frisbee = orange,
puzzle = red, other = pink). Older toys without a `color` field still work. No DB migration was needed.

## Rendering (`rasterize(model, angle)`)

- **World:** units are sprite pixels. y is up, z points at the viewer, and the model's origin sits on the shelf.
  Orthographic camera tilted down ~29° (`PITCH`). The origin lands at sprite row `FLOOR_ROW` (25), centered.
- **Shapes** are signed distance functions: `sphere`, `ellipsoid`, `capsule`, `roundBox`, `disc` (upright
  puck), `torus` (flat ring), plus `tipped(shape, angle, py, pz)` to lean a shape toward/away from the viewer.
  A model can also have `cuts` (shapes subtracted from it, like the treat hole in the puzzle toy).
- **Paint:** each part's `mat` is a color id, or a function `(x, y, z) => colorId` in model space for patterns
  (tennis-ball seam, rope twist, ribbon, frisbee ring). `ink` is the eye/nose color.
- **Shading:** Lambert light from the top left (`LIGHT`) → 4 tones of the color's ramp, with 4×4 Bayer
  dithering at the tone edges. `gloss: true` models get a cream highlight pixel.
- **Outlines:** outside the silhouette = `C.navy`. Inside, a pixel whose neighbor is >2.5 units nearer uses the
  ramp's darkest tone (separates head from body, etc.).
- **Shelf shadow:** rays that miss hit the shelf plane (y = 0, |z| ≤ `SHELF_DEPTH`) and march toward the light.
  Shadowed pixels are translucent navy, checker-dithered at the soft edge.
- Cost: about 4–10 ms per sprite. `toySpriteURL(toy, frame)` caches data URLs by `kind:color:frame`.
  `FRAMES` = 24 angles per turn. Frame 0 is the model's best side (`face`, in frames). `shelfFrame(toy)` picks
  a stable small turn (±1–2 frames) from the toy id so a shelf doesn't look cloned.

### Colors (`TOY_COLORS`)
Each is a ramp `[darkest, shade, base, light]` built from PICO-8's 16 colors plus its 16 "secret" colors
(added to `C` in `pixel.js`: `darkBrown`, `midnight`, `darkPlum`, `teal`, `rust`, `mauve`, `taupe`, `butter`,
`crimson`, `tangerine`, `lime`, `cobalt`, `grape`, `coral`, `salmon`). They appear as swatches in the toy editor
automatically.

### Custom toys so far
| Model id | Real toy | Default for |
|---|---|---|
| `sweater-bear` | Teddy's brown plush bear: tan muzzle, red sweater with a navy band (white hearts) and a white band (red hearts), fluffy white hat with a red & navy stripe and a pom-pom, tipped over his right ear. `color` recolors the sweater. Uses the non-pickable `fur` ramp and `fuzzy()` for the hat. | Teddy (`default-sweater-bear`) |
| `nacho-chip` | A big plush nacho-cheese tortilla chip (giant dog-toy Dorito): a puffy rounded triangle (new `pillowTriangle()` helper), orange with lighter yellow patches, a thin reddish toasted band, and dark brown specks placed from the photo (mirrored on the back). `color` recolors the base. `fuzzy()` at a low amount for the plush texture. | Teddy (`default-nacho-chip`) |
| `dogquila` | Fuzzyard "Silver Dogquila" plush tequila bottle: silver-cream body (`color` recolors it) with a black front label (gray trim, white dashes standing in for the lettering, a little dog), a "slobber responsibly" tag, white neck with a black band, and a peach cork. Label is front-only (`z > 1.5` in the body's `mat`). | Teddy (`default-dogquila`) |
| `lamb-chop` | Multipet's Lamb Chop lying flat: cream fleece (`color`), big head with a smooth white muzzle, black lash eyes, brown nose stitch, red smile, floppy peach ears, front legs forward with red hooves, back legs stretched behind, a tail tuft. No `face` turn: it lies straight along the shelf. **Two slots wide** (`span: 2`, see below). | Teddy (`default-lamb-chop`) |
| `pup-light` | Nestpark's "Pup Light" plush beer can (a Bud Light parody): royal blue (new non-pickable `royal` ramp, used when `color` is the default blue) with a lighter top band, a dark diamond crest with a white paw, white blocks for the PUP LIGHT lettering over two white lines, gray rims. Printed on the back too. Smooth (no `fuzzy`) so the print stays crisp. | Teddy (`default-pup-light`) |

### Big toys that take two shelf slots (`span: 2`)
A model can return `span: 2`. `spriteSize(model)` then makes its sprite 64×48 instead of 32×32: twice as wide, plus
`WIDE_PAD_ROWS` (8) above and below, because a long toy turned end-on in the viewer reaches up (pointing away) or down
(pointing at you) and would otherwise clip. The shelf surface lands at row `FLOOR_ROW + top` (33). On the Toy Wall the
sprite has `-8` rows of margin top and bottom (and `pointer-events: none`), so its floor lines up with the other toys;
the viewer/editor turntables pass `top` to `shelfStyle()` so the plank moves down with it. `toySize(toy)` gives
`{ w, h, top }` and `toySpan(toy)` how many slots a toy takes. A `scaled(shape, k)` helper grows a whole model. In `app.js`, `toyImg()` sizes the image (and adds a `wide` class), the Toy Wall fills shelves
by width (a big toy that doesn't fit at the end of a shelf starts the next one), the viewer uses scale 5 instead of 6 so
it fits a phone, and the editor's TYPE grid gives it a double-wide tile. CSS: `.toy-slot.wide`, `.toy-spin.wide`,
`.toy-preview-img.wide`, `.turntable.wide`, `.pick.wide`, `.toy-pick.wide`, `.toy-thumb.wide`. `shelfFrame()` gives a two-slot toy
no random tilt, so it lies straight along the shelf. The preview tool handles wide sprites too. Keep a two-slot model within about x ±28.

### Recreating a real toy (e.g. from a screenshot)
1. Add a model to `MODELS` in `js/toys.js`: `myToy: (color) => ({ face, gloss, parts: [...], cuts })`.
   Build it from the shape helpers. Keep it inside about ±13 px wide and 22 px tall so it fits the sprite at
   every angle. Use `accent(color, wanted, fallback)` for secondary colors that must contrast with the main one.
2. Add its id to `TOY_KINDS` in `app.js` (label shown in the editor's TYPE grid, plus `icon`: which flat 8×8 icon
   stands in for it in small spots) and to `DEFAULT_COLOR`.
   If the owner wants it already on a dog's shelf, add it to `DEFAULT_TOYS` in `app.js` (dog name + toy with a fixed
   id). `addDefaultToys()` runs after every load or backup restore. It adds the toy once, then records the id in
   `dog.defaultToys`, so if the owner deletes the toy it stays deleted.
3. Check it from all angles. Fastest: in Node, `rasterize` a copy of `toys.js` (append
   `export { rasterize, MODELS }`) and write the frames to a PNG with Pillow. Or render `toySpriteURL` frames onto a
   canvas in the page.
4. Bump `CACHE` in `sw.js`.

## The room art
- `plankURL()`: a 16×14 repeating plank tile: rows 0–5 shelf top, row 6 lit lip, 7–10 front face, 11 underside,
  12–13 translucent shadow on the wall. `SHELF_TOP_ROW` (22) is the sprite row where the plank's top starts, so
  CSS lines the plank up with the toys' shadows.
- `wallpaperURL()`: a 16×16 teal wallpaper tile with a paw print (shown at 3× = 48px).
- `portraitURL()`: a 36×36 framed pixel portrait of Teddy: his real photo shrunk to 28×28 (`PORTRAIT` rows +
  `PORTRAIT_COLORS` in `toys.js`), generated by **`tools/make-portrait.py`** (white-balanced because the room light turns
  white fur tan, the busy background faded to the wall's teal, snapped to a neutral palette, no dithering). Rerun that
  tool (its docstring has the arguments and the crop used for Teddy: `--box 130,500,1060,1430 --ellipse 400,375,375,290
  --ellipse 790,450,120,170 --ellipse 420,820,470,300 --gains 1.11,1.22,1.42`) to make a Cookie portrait or swap the
  photo. It is *not* tiled: `body.toy-room::before` places exactly five of them in the side margins, only at
  `min-width: 1260px` (shown at 2× = 72px; 3× = 108px from 1500px) so they clear the bookcase (positions are in `styles.css`). The bookcase's back
  panel paints its own darkened wallpaper (`background-attachment: fixed` so the paws line up with the room's) instead
  of being see-through, so a portrait can never show through it. The toy viewer's turntable uses the plain wallpaper.

## Screens (in `app.js`, banner "Toy wall")
- **Route** `#/toys`, tab **TOYS**. **One shared wall for every pup** (the owner's decision: all the toys belong to
  both Teddy and Cookie). `allToys()` merges every dog's `toys` (de-duplicated by toy id), so it doesn't matter which
  dog's record a toy is saved in; defaults still get saved on Teddy. There's no dog switcher. The plaque reads
  "COOKIE & TEDDY'S TOYS · N" (`pupNames()`). Old `#/toys/<dogId>` links still work (the id is ignored).
- `renderToys()`: a wooden bookcase. Toys are sorted best-rated first, so favorites are on the top shelf; 5-bone
  toys get a star on their name tag. **The wall is display-only: no add/edit buttons.** The owner adds toys by sending
  photos to an agent (see the toy-maker skill). Empty slots fill out at least
  `MIN_SHELVES` (4) shelves. `shelfLayout()` picks the pixel scale (3×, or 4× at ≥700px) and how many toys fit
  on a shelf (3–8). The screen re-renders on resize.
- CSS (`styles.css` → "Toy wall"): `body.toy-room::before` is the wallpaper. The shelf art is sized with
  `--s` (CSS px per art pixel), and `--plank`, `--wallpaper`, `--shelf-top` come from `shelfStyle(scale)`.
- **Toy viewer** (`openToyViewer`, action `view-toy`): a sheet with the toy spinning at 6× on its own shelf (8 FPS,
  stops itself when the sheet closes), name, color + type, bones, caption, and notes. There's no EDIT button.
- **Toy editor** (`openToyEditor`): no longer reachable from the wall; it's only used by the dog profile's
  **+ ADD TOY** / toy rows (My Dogs → a dog). A live 3D preview, the TYPE grid as 3D sprites, and COLOR swatches. Until the
  owner picks a color (`data-color-picked`), the color follows the chosen type's default (`refreshToyPreview`).
- The dog profile's toy rows show the 3D sprite and open the viewer. **TOY WALL ▶** links to the shared wall.

## Testing tip
The T3 preview's screenshot tool tends to hang on these pages. To eyeball sprites, draw them onto a canvas in
the page and inspect the PNG. Seed test dogs only in the **incognito** profile, and delete them after.
