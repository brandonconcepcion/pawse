---
name: pawse-toy-maker
description: Recreate a real dog toy from the owner's photos as a custom 3D pixel-art model for the Pawse app's Toy Wall, register it, optionally make it a default on a dog's shelf, and verify it. Use when the owner sends toy photos/screenshots, or asks to add, fix, or restyle a toy model.
---

# Pawse toy maker: handoff for building toys from photos

You're adding toys to **Pawse**, a free 8-bit dog app (vanilla JS PWA, no build step) at `~/Developer/pawse`.
Live: https://brandonconcepcion.com/pawse/. The owner is addressed as "GOAT". They send photos of their dogs'
real toys, and you turn each into a small 3D model that renders as chunky pixel art and sits on a shelf on the
**Toy Wall** (and spins when tapped). Read this whole file first. It records how the first custom toy (Teddy's
Sweater Bear) was made, including what went wrong.

Read next, only as needed: `AGENTS.md` (project rules), `docs/context/08-toys.md` (how the renderer, screens and
data work), `js/toys.js` (the models, search for `MODELS`). You don't need the rest of the app.

## Ground rules (these matter)

1. **Never wipe or overwrite the owner's data.** Their real dogs (Teddy, Cookie) live in the browser profile at
   `http://localhost:8642`. Test only in the **incognito** preview profile with throwaway dogs you create, and
   delete only those. Never "clear storage". (A past cleanup deleted Teddy and had to be restored.)
2. **Don't commit or push unless the owner asks.** Pushing to `main` publishes to the live site. If asked, use
   the GitHub noreply commit email already configured in the repo (not a work email), and bump `CACHE` in `sw.js`.
3. **Touch only these places** (so you don't collide with other work):
   - `js/toys.js`: your model inside `MODELS`, its entry in `DEFAULT_COLOR`, optionally a non-pickable material ramp in `RAMPS`.
   - `js/app.js`: the `TOY_KINDS` list and `DEFAULT_TOYS` (both near the top).
   - `sw.js`: bump `CACHE` (`pawse-vN`).
   - Docs: `docs/CHANGELOG.md` (new entry on top), the "Custom toys so far" table in `docs/context/08-toys.md`.
4. Match the surrounding code style: short "why" comments, no new dependencies, no build step.
5. Only one agent should edit the repo at a time. If another agent is active, use a git worktree.

## Setup

```sh
cd ~/Developer/pawse
python3 -m http.server 8642     # skip if already running: curl -s -o /dev/null -w "%{http_code}" http://localhost:8642
node --check js/toys.js js/app.js
```

The preview tool (no browser, no packages; needs Node 22.7+):

```sh
node tools/toy-preview.mjs <model> [color] [frames] [out.png] [scale]
node tools/toy-preview.mjs sweater-bear red 0,3,6,12,18 /tmp/bear.png 8
```

It writes the model from the angles you list (0–23, 15° apart, 0 = front) as a PNG, and prints the bounding box over
all 24 angles. **Look at the PNG** (open it with your image-reading tool). Re-run it after every edit.

## Procedure

### 1. Study the photos before writing code
Write down, in a few lines each:
- **Silhouette and proportions.** Head vs body size, limbs, anything that sticks out (ears, hat, tail). Measure
  relative sizes ("head ≈ body height", "legs short and stubby").
- **Colors**, as few as you can: usually 3–5 are enough. Note which ones carry the toy's identity (the bear's red
  sweater, navy/white bands, white hat).
- **Patterns/markings and where they sit.**
- **Which side is the "front"**, and what's different on the back (the bear's hat pom-pom only showed from behind).
- **Materials**: plush/fuzzy, shiny rubber, rope, hard plastic. Shiny things get `gloss: true`. Fuzzy things get
  the `fuzzy()` helper.
Use every photo the owner gave (front, back, side). If a detail can't be seen in any photo, keep it simple rather
than invent it. At 32×32 pixels a fine pattern (knitted hearts, text, a logo) becomes **rows of dots or bands of
color**. Capture the *rhythm and palette* of a pattern, not its exact shapes.

### 2. Break it into primitives
Everything is a signed distance field (SDF) in **sprite pixels**. Axes: **x right, y up, z toward the viewer**, origin
at the middle of the shelf's surface. A good toy fits in about **x −13..13, y 0..24**. Shape helpers in `toys.js`:

| Helper | Use for |
|---|---|
| `sphere(cx,cy,cz, r, mat)` | balls, noses, knobs, pom-poms |
| `ellipsoid(cx,cy,cz, rx,ry,rz, mat)` | bodies, heads, muzzles, ears, feet |
| `capsule(ax,ay,az, bx,by,bz, r, mat)` | limbs, ropes, bones, tails, sleeves |
| `roundBox(cx,cy,cz, hx,hy,hz, round, mat)` | boxes, blocks (half-sizes `hx,hy,hz`) |
| `disc(cx,cy,cz, r, halfHeight, round, mat)` | upright pucks, plates (axis = y) |
| `torus(cx,cy,cz, ringR, tubeR, mat)` | flat rings (axis = y) |
| `tipped(shape, angle, pivotY, pivotZ)` | lean a shape toward (+) or away (−) from the viewer |
| `fuzzy(shape, amount)` | lumpy, furry surface |
| `band(value, a, b)` | alternating stripes (rope twist) |
| `accent(color, wanted, fallback)` | a second color that must differ from the main one |

A model is `(color) => ({ face, gloss, parts: [...], cuts: [...] })`:
- `parts`: shapes unioned together. **Order doesn't matter for shape**; each pixel takes the closest part's material.
- `cuts` (optional): shapes subtracted, like a hole.
- `face` (optional, in frames, 15° each): turns the model so its best side faces you at frame 0. The bear uses `face: 1`
  so both eyes show; the rope uses `2`.
- `gloss: true`: adds a shiny highlight pixel.
- **`mat` is a color id, or a function `(x, y, z) => colorId`** in model space, used for patterns: bands by `y`,
  dots by `Math.atan2(z, x)` (angle around the body), stripes by `x`. Look at `sweater-bear`'s `knit()` and the
  rope's `twist` for examples.

Color ids you can use in `mat`: every `TOY_COLORS` id (`red orange yellow lime green blue purple pink brown tan white gray
black`) plus `ink` (eyes/nose, near-black) and `fur` (soft plush brown). The model's `color` argument is the user-pickable
main color, so use it for whatever part should recolor (the bear's sweater). Hard-code the rest. **If you need a
material that isn't there** (say, a gold ramp), add a ramp to `RAMPS` in `toys.js`: `[darkest, shade, base, light]`,
built from the palette `C` in `js/pixel.js` (PICO-8's 16 colors plus its 16 "secret" ones; add a hex there only if
you must). Don't add it to `TOY_COLORS` unless the owner should be able to pick it.

### 3. Build, render, compare, repeat
1. Add the model to `MODELS` (a `// comment` line saying which real toy it is) and its main color to `DEFAULT_COLOR`.
2. Run the preview tool. Check **several angles**: front (0), back (12), both sides (6, 18), and a three-quarter (2 or 22).
3. Compare to the photos **at pixel size**. Ask: would the owner recognize it at a glance? Fix the biggest problem first
   (silhouette > main colors > face > patterns > small details).
4. Iterate until it reads. Typical loop is 3–6 renders.

Lessons from the Sweater Bear (apply them):
- **Eyes and noses: use tiny radii (≈0.5–0.8) and put them just outside the head surface.** At radius 0.8 the eyes
  merged into a black bar. Eyes sit a hair in front of the head's front surface (`z` slightly beyond it) so they don't
  get swallowed.
- **Pattern bands: put them where they show in the photo, and make them 1.5–3 px tall.** Thinner than ~1.5 px
  disappears; too low on the body and the shading hides them. The navy band had to move up the chest and get thicker.
- **Use the head/torso ratio from the photo.** Plush toys are usually big-headed and short-limbed. Stubby legs
  made the bear read as a bear.
- **A turned face reads better than dead-on.** A one-frame turn (`face: 1`) gave depth and showed both eyes.
- **Orientation signs are easy to get backwards.** The frisbee was lit from underneath (dark, ugly) until the tilt sign
  flipped. If something looks dark or upside-down, flip a sign before reworking the shape.
- **Shading is stepped, 4 tones per color.** Very dark base colors (navy, black) lose their form. Use the lighter
  ramp or add a lighter accent.
- **Detail from the back matters**: the spin viewer shows every angle, so give the back something (the hat pom-pom,
  the sweater's back pattern) even if it's simple.
- **Check the bounding box line.** If it prints WARNING, shrink the model or move it down/in. Clipped sprites look broken.

### 4. Register it
In `js/app.js`, add to `TOY_KINDS` (it shows up automatically in the editor's TYPE grid with a live 3D thumbnail):

```js
{ id: 'my-toy', label: 'Squeaky Pig', icon: 'squeaky' },   // icon = the closest flat 8×8 icon, for small spots
```

`icon` must be one of `ball rope squeaky plush chew frisbee puzzle other` (shown in the dogs list "LOVES …" and
elsewhere). The model id is kebab-case and **permanent**: it's saved in the owner's data, so renaming it later
orphans existing toys (they'd fall back to the gift box). Pick it carefully.

### 5. Put it on the shelf by default (only if the owner asked)
In `js/app.js` → `DEFAULT_TOYS`, add an entry (dog name in lowercase, a **fixed** toy id, `kind` = your model id):

```js
{ dog: 'teddy', toy: { id: 'default-my-toy', name: 'Squeaky Pig', kind: 'my-toy', color: 'pink', rating: 4, notes: 'Where it came from, quirks.' } }
```

How it works: `addDefaultToys()` runs after every load and backup restore. It adds the toy to the dog (matched by
name, case-insensitive) **once**, then records the id in `dog.defaultToys`, so if the owner deletes the toy it stays
deleted. Use the right dog (Teddy or Cookie). Pick a sensible rating (1–5 bones) and a short, factual note.
**Don't add defaults the owner didn't ask for.**

### 6. Verify in the real app (incognito only)
```text
preview_open  url=http://localhost:8642/#/toys  profileId=incognito  reuseExistingTab=false  open=false
```
In that tab (`preview_evaluate`), first refresh cached modules: `for (const f of ['/js/toys.js','/js/app.js','/sw.js'])
await fetch(f,{cache:'reload'})`. Then seed **throwaway** dogs with the real names you need:

```js
const db = await import('/js/db.js');
await db.saveDog({ id:'test-teddy', name:'Teddy', coat:'teddy', size:'small', toys:[], createdAt:1, photo:'', photoPixel:'' });
location.hash = '#/toys/test-teddy'; location.reload();
```
Check: the toy appears on the wall (its name tag in `.toy-tag`); tapping it opens the viewer and it spins; the editor's
TYPE grid lists the new kind and recolors it; a dog that shouldn't get the default doesn't; deleting the toy and
reloading keeps it gone. Finally delete your test dogs: `await db.deleteDog('test-teddy')`, and close the tab.

**Known tooling trap:** the preview's screenshot tool often **times out** on these pages (and always while a sheet is open).
Don't fight it. Use the PNG tool in step 3, or draw sprites onto a `<canvas>` in the page and POST the data URL to a
tiny local server to save it, then read the file. Measuring DOM boxes with `getBoundingClientRect` also works for layout.

### 7. Finish
1. Bump `CACHE` in `sw.js` (`pawse-vN` → `pawse-v(N+1)`). `js/toys.js` is already in `ASSETS`.
2. `node --check js/toys.js js/app.js`. The dev server serves files live, so there's nothing to rebuild or restart.
3. Docs: add a row to "Custom toys so far" in `docs/context/08-toys.md`, a dated entry on top of `docs/CHANGELOG.md`
   (what/why/files/verified), and mention it in `README.md` only if it's a notable feature.
4. **Don't commit or publish** unless asked. Tell the owner the toy is ready at `http://localhost:8642/#/toys` (they should
   hard-refresh with Cmd+Shift+R), and offer to publish.
5. In your reply: show the preview PNG (embed the file path as an image), list what you copied from the photos, what you
   simplified and why, and what you added by default.

## Quick reference

- Sprite is 32×32, camera tilted down ~29°, light from top-left, 24 turn frames. `FLOOR_ROW` 25 is the shelf surface.
- A big toy can take two shelf slots: return `span: 2` from the model (64×48 sprite, keep it within x ±28). The app
  handles the rest. See `lamb-chop` and "Big toys" in `docs/context/08-toys.md`.
- A render takes ~4–12 ms. Keep models to roughly 4–20 parts.
- Pickable colors: `TOY_COLORS` in `toys.js`. Add one by adding a ramp (then it shows up as a swatch automatically).
- Existing models to copy from: `ball` (pattern by a function), `rope` (bands), `squeaky` (smooth, glossy, `face`),
  `plush` (generic bear), `chew` (capsules), `frisbee` (`tipped`), `puzzle` (`cuts`), `other` (box + ribbon),
  `sweater-bear` (multi-band clothing, fuzzy hat, fur ramp).
- Test data lives only in the incognito profile. The owner's real data is at the default profile on `localhost:8642`.
- Owner preferences: call them **GOAT**; plain, friendly updates; verify before claiming done; short messages.
