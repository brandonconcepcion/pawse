# Changelog / dev log

Newest first. Each entry: **what** changed, **why**, **files**, and **notes for the next agent**.
Add an entry for every meaningful change (see `AGENTS.md` → "Keeping the docs alive").

---

## 2026-10-28: Chuckit! lies down across two slots
**Why:** Standing up in one slot, the launcher had to be squashed and the owner wanted to see the whole thing.
**What:** `chuckit` is now `span: 2` (64×48 sprite). The launcher lies on its side at full length: the cup faces you, the handle
curves down from the cup to the shelf, and the grip stands on its edge so its slot shows. The ball sits at the left end.
Then the owner asked for a longer handle: the straight part is now 14 long instead of 10, and everything shifted 2 left to stay
centered (it fills columns 4–59 of 64 over the whole turn). Cache is `pawse-v42`.
**Notes:** Lying the grip flat hid the slot, because the camera pitch is only ~29°. Standing it on its edge shows the slot.

---

## 2026-10-28: Chuckit! launcher + ball
**Why:** The owner sent a photo of a Chuckit! launcher holding its ball and wanted both pieces shown separately, in the same shelf spot.
**What:** `toys.js`: new `chuckit` model. The launcher stands with its empty cup open toward the ball, and the ball sits beside it on the shelf.
New non-pickable ramps `flame` (red-orange ball) and `aqua` (light blue seam). The `ball` icon is used in `TOY_KINDS`, and it's a
Teddy default (`default-chuckit`, rated 4). Cache is `pawse-v40`.
**Notes:** The `orange` ramp read yellow and `salmon` read pink for the ball's lit side; `coral` matches the real red-orange.
The cup faces the ball: facing the viewer made it read like a racket or magnifying glass.

---

## 2026-10-28: Pups Blue Rubbin beer can
**Why:** The owner sent a photo of Nestpark's "Pups Blue Rubbin" plush can (a Pabst Blue Ribbon parody), the Pup Light's partner.
**What:** `toys.js`: new `blue-rubbin` model (same can shape as `pup-light`, white with a red sash, blue circle + banner,
bones, wreath, red bottom line) and `DEFAULT_COLOR` white. `app.js`: `TOY_KINDS` entry and a Teddy default
(`default-blue-rubbin`, rated 4). Cache is `pawse-v39`.
**Notes:** At 32px the lettering only works as one-pixel dashes; `letters()` from the Pup Light (3-on, 1-off) turned to
mush here because the gaps are under a pixel. `face` stays 0: turning it either way pushes the circle into the shaded side.

---

## 2026-10-28: Cookie portraits join Teddy's on the toy wall (8 portraits)
**Why:** The owner sent a Cookie photo and wanted it pixelated into the wall too, going past the old five-portrait limit.
**What:** `toys.js`: `PORTRAIT` is now `TEDDY_PORTRAIT`, plus a new `COOKIE_PORTRAIT`; `portraitURL(dog = 'teddy')`
caches one framed 36×36 per dog. `app.js` sets `--portrait` and `--portrait-cookie`. `styles.css`: three Cookie portraits
mixed in with Teddy's five (left 3% 25%, right 97% 5% and 94.5% 40%), at 72px / 108px, still only from 1260px wide.
`tools/make-portrait.py` gained `--gamma` (lifts shadows): Cookie's photo is dim and cool, so her fur in shade read
brown. Her crop: `--box 730,250,1480,1000 --ellipse 375,225,290,230 --ellipse 330,600,300,340 --size 28 --gamma 0.5
--gains 1.25,1.22,1.14`. Cache is `pawse-v38`.
**Notes:** A tighter crop (head + chest) reads much better at 28px than the whole dog. The image viewer shows photos
brighter than their real pixels, so measure values with Pillow before choosing gains. Measured in the page at 1300px:
all eight portraits clear the bookcase and each other.

---

## 2026-10-28: Teddy and Cookie are the default dogs (for new visitors)
**Why:** The app is public, and the owner wants anyone visiting to see Teddy, Cookie and the toy wall. Their personal
walking/weight/food data must not be part of that.
**What:** `DEFAULT_DOGS` + `addDefaultDogs()` in `app.js`: on a device with **no dogs and no `pawse.defaultDogsAdded`
flag**, add Teddy (teddy coat, small) and Cookie (cookie coat, plump). Name, coat and size only: no photo, birthday,
goal weight, weigh-ins, food, or play sessions. The flag is set on every load, so deleting them sticks, and a device
that already has dogs never gets them added. `DEFAULT_TOYS` then puts the toys on Teddy. A backup restore still
replaces everything (including these), and the owner's real data on `localhost` is untouched.
**Verified:** fresh visit → both dogs, 5 toys, 0 weights/sessions, gym + stats render; delete both + reload → stays empty;
device with its own dog → nothing added. `sw.js` is `pawse-v37`.

---

## 2026-10-28: Toy Wall is the landing page
**Why:** The owner loved the toy wall and wants the app to open on it.
**What:** `parseRoute()` sends an empty hash (opening the app, or the home-screen icon) to `#/toys` instead of the last
play/gym area. If a play timer is running or paused it opens `play` instead, so a countdown is never hidden. The tab bar
still remembers park vs gym for its first tab. `sw.js` is `pawse-v36`.
**Verified:** in a private window with "last area = gym": no hash → toy wall (TOYS tab active); with a running timer →
the park with the timer. Test data removed.

---

## 2026-10-28: Teddy's real photo on the wall (pixelated)
**Why:** The owner sent a photo of Teddy and asked for it in the toy wall's background, more pixelated.
**What:** The five framed wall portraits now show that photo instead of the hand-drawn face. New
`tools/make-portrait.py` (Pillow + numpy, dev only) crops, white-balances (the warm room light made his white fur
tan), fades the busy background to teal with soft ellipses, and snaps to a 13-color neutral palette with no dithering
(dithering looked noisy). `toys.js`: `PORTRAIT` (28×28 rows) + `PORTRAIT_COLORS`, `portraitURL()` is 36×36 with a wood
frame. `styles.css`: portraits 72px (2×), and 108px (3×) from 1500px wide. They only appear at ≥1260px, so phones
don't show them. `sw.js` is `pawse-v35`.
**Verified:** at 1440px the five portraits sit in the margins and clear the bookcase (checked by measuring and drawing
the layout; the preview screenshot tool timed out again).

---

## 2026-10-28: One shared toy wall for both pups
**Why:** The owner said all the toys belong to both Teddy and Cookie, so there should be no per-dog distinction or filter.
**What:** `renderToys()` now shows every dog's toys on one wall (`allToys()`, de-duplicated by id), sorted best-rated
first. Removed the dog chips, `toyWallDog()` and the `pawse.toyDog` setting. The plaque is "COOKIE & TEDDY'S TOYS · N"
and the viewer title says the same. `#/toys/<id>` still works (the id is ignored). `view-toy` looks a toy up across all
dogs (no `data-dog`), and the dog profile's **TOY WALL ▶** goes to `#/toys`. `sw.js` is `pawse-v34`.
**Unchanged:** new default toys are still saved on Teddy (it doesn't matter which dog holds them). The five framed
portraits on the wall are still all Teddy.
**Verified:** in a private window, a toy only on Cookie's record and one on both records show once each, there are no
chips, the viewer opens, and the profile page still opens toys.

---

## 2026-10-28: Pup Light made slimmer
**Why:** The owner liked the Pup Light but found it a bit too wide.
**What:** In `js/toys.js` (`pup-light`), the can's `disc` radius went from 6.6 to 5.7 (about 14 px wide down to about
12), and the crest, paw, PUP/LIGHT letter blocks and white lines were narrowed to match so they still fit.
A trial at 5.3 was too thin: the lettering fell apart.
`sw.js` cache bumped.

---

## 2026-10-28: Pup Light beer can
**Why:** The owner sent a photo of Nestpark's "Pup Light" plush beer can and wanted it as a Teddy default.
**What:** New `pup-light` model in `js/toys.js`: one smooth `disc` with a `mat` function for the label (gray rims, light
top band with a dark diamond crest and white paw, white letter blocks for PUP and LIGHT, two white lines), printed front
and back. New non-pickable `royal` ramp for the deep blue; its shade tones stay off navy so the shadowed side doesn't
merge into the outline. Listed as "Pup Light" (icon `plush`), default for Teddy (`default-pup-light`, 4 bones).
`sw.js` cache is now `pawse-v32`.
**Simplified:** the lettering is rows of white blocks (no room to spell at 32×32); the "nestpark" logo, "ORIGINAL" and
"CHEW TOY" text and the banner around the crest were left out.

---

## 2026-10-28: Toy Wall is display-only
**Why:** The owner will add toys by sending photos to an agent, so the wall doesn't need add/edit controls ("mainly just
for show").
**What:** Removed the header **+** button, the **+ ADD TOY** shelf slot (and its `.toy-ghost` / `.toy-slot.add` CSS), and
the viewer's **EDIT** button. Tapping a toy still opens the spinning viewer. The toy editor and the dog profile's
**+ ADD TOY** / toy rows are unchanged (that's how toys can still be deleted or rated).
**Files:** `js/app.js` (`renderToys`, `openToyViewer`), `styles.css`, `sw.js` (v31), `docs/context/08-toys.md`.
**Verified:** in a private window, no add buttons on the wall, the viewer has no EDIT, and toys still open and render.

---

## 2026-10-28: Lamb Chop, the first two-slot toy
**Why:** The owner sent photos of Multipet's Lamb Chop and asked for it as a Teddy default that takes two shelf spots,
since it's so big.
**What:** New `lamb-chop` model (`span: 2`) in `js/toys.js`, listed as "Lamb Chop" (icon `plush`), default for Teddy
(`default-lamb-chop`, 4 bones). New support for two-slot toys: `spriteSize()`, `WIDE_EXTRA_ROWS`, `toySpan()`; `rasterize()`
and `toySpriteURL()` use the model's sprite size. `app.js`: `toyImg()` helper, shelves filled by width, wide viewer/editor/
TYPE grid/dog-page thumbnails, `pixelImg()` takes an optional height. `styles.css`: the `.wide` rules. `tools/toy-preview.mjs`
renders wide sprites. `sw.js` cache is now `pawse-v30`.
**Update:** the owner wanted it lying straight along the shelf, so the model has no `face` turn and `shelfFrame()` gives
two-slot toys no random tilt (a turned long toy poked diagonally off the front of the shelf). Then the head grew ~20% (radius
6.3 → 7.6, face, muzzle and ears scaled with it), set a little lower and closer to the body so it still clears the top of
the sprite when the toy spins end-on. Then, by request, the whole lamb got fuller and bigger: plumper body, thicker
legs, bigger hooves, round fluffy black eye patches instead of thin dashes, and everything scaled 1.12× with a new
`scaled()` helper. To make room for the spin, two-slot sprites are now 64×48 (8 spare rows above as well as below,
`WIDE_PAD_ROWS`); `toySize()` and `shelfStyle(scale, top)` keep the shelf and turntable planks lined up. Verified at
iPhone size: same floor line and tag height as the other toys, still tappable, spins inside the viewer with the plank under it. Last pass: the whole head group (face and ears)
is grown another 1.25× around its chin with `scaled(part, k, cx, cy, cz)`, the back legs and ear tips are a bit shorter, and
the model is nudged right, so it still fits 64 columns at every angle. From a new reference photo: that was too big, so
the head is now grown 1.12×; the eyes are closed lids with a short lash fringe that flicks out at the corners, painted onto
the face by a `mat` function in a new solid-black `lash` ramp (the `ink` ramp turns mauve on the lit side); the ears stick
up and out. Then the head was tipped back ~17° from the neck (`tipped(part, -0.3, 3, 1.8)`) so it looks up and out like the
photo, and the lid line thinned so the lash spikes stay separate when the face is more frontal. The red smile became a
bigger tongue that pokes out past the muzzle. Details in `docs/context/08-toys.md` → "Big toys".
**Verified:** all angles rendered (fits 64×40 at every angle). In a private window at iPhone size: a test Teddy got it
(Cookie didn't), it spans two of three slots, the viewer spins it inside the turntable (320px), the editor shows a double-wide
TYPE tile and the preview resizes when switching kinds, deleting it stays deleted after reload. Test dogs deleted.
**Notes:** on a phone the dog page's toy row for a wide toy is taller (its thumbnail leaves less room for the notes).

---

## 2026-10-28: Five Teddy portraits (not a tiled pattern), rounder-necked Dogquila
**Why:** The owner wanted about five of Teddy's faces in total, none behind the bookcase, and the Dogquila's body and top
looked too squished together.
**What:** `wallpaperURL()` is back to the plain 16×16 paw tile (48px in the CSS). New `portraitURL()` (20×20 framed face);
`body.toy-room::before` hangs five of them in the side margins at `min-width: 1260px` (narrower screens have no room
beside the bookcase, so they show the plain wall). `.bookcase` now paints its own darkened wallpaper instead of being
see-through. `app.js` sets `--portrait` next to `--wallpaper`. Dogquila: a shorter round body, small shoulders, a longer
narrow neck, and the black band moved up under the collar (the camera tilt hid the bottom of the neck, so a low band
sat right on the shoulders). `sw.js` cache is now `pawse-v22`.

---

## 2026-10-28: Teddy's portraits on the toy-room wallpaper
**Why:** The owner asked for Teddy's face in different spots on the toy page's wallpaper, in the same pixel style.
**What:** `wallpaperURL()` in `js/toys.js` is now a 64×64 tile (was 16×16) with two framed 16×16 pixel portraits of Teddy
hung at scattered spots among the paw prints (paws are skipped under a frame). `TEDDY_FACE` is hand-pixelled from the photo
using the app palette. `styles.css`: the two wallpaper `background-size` values went from `48px` to `192px` (3× per art pixel, as before).
`sw.js` cache is now `pawse-v21`.
**Notes:** the same wallpaper shows on every dog's wall and on the toy viewer's turntable.

---

## 2026-10-28: Third custom toy, Dogquila
**Why:** The owner sent a photo of Fuzzyard's plush "Silver Dogquila" tequila bottle.
**What:** New `dogquila` model in `js/toys.js`: a fuzzy rounded-box body with a front-only black label (trim, dashes for the text, dog, 20 / 03), a small tag, a white neck with a black band, and a peach cork. Body color is recolorable (default `gray`). Listed as "Dogquila" in the TYPE grid (icon `plush`). `sw.js` cache is now `pawse-v18`. Added to Teddy by default via `DEFAULT_TOYS` (`default-dogquila`, 4 bones).
**Update:** the body is a custom pillow with big rounded corners (`rounded()` helper, radius 5.4) instead of a `roundBox`, and the label has rounded corners too, so it reads as a soft squircle bottle rather than a block.
**Simplified:** the writing is rows of white dashes, since real text can't survive at 32×32.
**Verified:** rendered at 6 angles with `tools/toy-preview.mjs`; checked in a private window (see below).

---

## 2026-10-28: Second custom toy, the Nacho Chip
**Why:** The owner sent a photo of a big plush tortilla chip (a giant Dorito) for their dogs.
**What:** New `nacho-chip` model in `js/toys.js` built on a new `pillowTriangle()` shape helper (rounded triangle, puffed in the
middle, thin at the rim). Cheesy orange base (`color` recolors it) with yellow highlight patches, a thin red toasted band and
brown specks taken from the photo, mirrored on the back. Listed as "Nacho Chip" in the editor TYPE grid (icon `plush`). `sw.js` cache
is now `pawse-v17`. Added to Teddy by default via `DEFAULT_TOYS` (`default-nacho-chip`, 4 bones).
**Verified:** rendered at 6 angles with `tools/toy-preview.mjs` (fits the sprite, no clipping). In a private window a test dog
showed it on the wall, it spins in the viewer, and the editor lists it; test dog deleted afterwards.

---

## 2026-10-28: Toy-maker handoff skill + preview tool
**Why:** The owner wants a separate agent to build toy models from their photos, so this thread's context doesn't fill up.
**What:** `.claude/skills/pawse-toy-maker/SKILL.md` is the full procedure (studying photos, primitives cheat sheet,
render-compare loop, lessons from the Sweater Bear, registering, default toys, incognito verification, what to
report). `tools/toy-preview.mjs` renders any model from chosen angles to a PNG and checks the sprite bounds.
`toys.js` now exports `MODELS` and `rasterize` for it.
**Notes:** the tool runs on plain Node 22.7+ (ESM detection), with no packages.

---

## 2026-10-28: First custom toy, Teddy's Sweater Bear
**Why:** The owner sent front and back photos of Teddy's plush bear and asked for it in the toy-wall style, added
by default.
**What:** A new `sweater-bear` model in `js/toys.js`: brown plush (new non-pickable `fur` ramp), tan muzzle, red
Fair Isle sweater with navy/white bands of hearts, red sleeves with a navy band, and a fluffy white hat with a pom
(a new `fuzzy()` helper adds lumps). It's listed in the editor's TYPE grid as "Sweater Bear", and `color`
recolors the sweater.
`DEFAULT_TOYS` + `addDefaultToys()` in `app.js` give it to the dog named Teddy once (rated 4 bones), tracked in the
new `dog.defaultToys` field (kept in backups), so deleting it sticks. `toyIcon()` maps custom kinds to a flat icon.
**Verified:** all angles rendered to PNG. In a private window: a test Teddy got the bear on load, Cookie didn't,
it stayed gone after deleting + reloading, and the editor lists the new type. Test dogs deleted afterwards.

---

## 2026-10-28: Toy Wall (3D pixel toys on shelves)
**Why:** The owner wants a dedicated toy page for building out Teddy's collection: "a huge wall with many rows of
shelves" where each toy is a "2D but 3D" interpretation. Next, they plan to send screenshots of real toys to
recreate in this style.
**What**
- `js/toys.js` (new): toys are tiny 3D models (SDF shapes) ray-marched into 32×32 sprites with stepped and dithered
  shading, outlines, gloss, and a cast shadow on the shelf. There are 8 models (one per toy type) in 13 color ramps,
  24 angles per turn, and plank/wallpaper tiles in the same 3/4 view.
- New **TOYS** tab / `#/toys[/<dogId>]`: a bookcase that fills the screen, with dog chips, a plaque, toys sorted
  best-first, hanging name tags (star for 5 bones), an ADD TOY slot, and at least 4 shelves.
- Tap a toy → viewer sheet with the toy spinning on its own shelf. Toy editor: live 3D preview, 3D type picks, and
  COLOR swatches (`toy.color`, optional). The dog profile shows 3D thumbnails and links to the wall.
- Added PICO-8's 16 "secret" colors to `C`. The tab bar fits 4 tabs (narrower tabs).
**Files:** `js/toys.js`, `js/app.js`, `js/pixel.js`, `styles.css`, `sw.js` (v14, toys.js in ASSETS), docs.
**Verified:** all models checked from all 24 angles (rendered to a contact sheet); the wall at phone width; viewer
spin, editor color logic (a picked color sticks; otherwise it follows the type), and saving, all in a private
window with test dogs (deleted afterwards).
**Notes:** the preview tool's screenshots hang whenever a sheet is open (and sometimes afterwards). Render sprites
to a canvas instead. See [08-toys.md](context/08-toys.md) for how to add a custom model from a screenshot.

---

## 2026-10-27: Back to brandonconcepcion.com/pawse (/dogs redirects)
**Why:** The owner prefers the Pawse name in the URL, but /dogs should keep working too.
**What:** Renamed the repo back `dogs` → `pawse`, so the app is at **https://brandonconcepcion.com/pawse/**. Created
a tiny separate repo `brandonconcepcion/dogs` (local: `~/Developer/pawse-dogs-redirect/`) with:
- `index.html` + `404.html`: forward to `/pawse/`, keeping the `#/...` hash (e.g. `/dogs/#/gym` → `/pawse/#/gym`).
- `sw.js`: a "kill switch" that unregisters the service worker Pawse registered while it lived at `/dogs/`. It
  deliberately does **not** delete caches (the real app shares the origin's cache storage).
**Notes:** Storage is per origin (brandonconcepcion.com), so dogs saved via either URL are the same data.

---

## 2026-10-27: Moved to brandonconcepcion.com/dogs
**What:** Renamed the GitHub repo `pawse` → `dogs` so the site lives at **https://brandonconcepcion.com/dogs/**
(GitHub Pages uses the repo name as the path). The app name stays Pawse; the local folder stays `~/Developer/pawse`.
**Also:** the service worker now only deletes its own `pawse-*` caches, since the whole domain shares cache storage.
**Notes:** The old `/pawse/` URL now 404s; it was only live for minutes. GitHub redirects git operations from the
old repo name, but the local remote was updated anyway. All docs updated to the new URL.

---

## 2026-10-27: Published on GitHub Pages
**What:** Public repo `brandonconcepcion/pawse`, GitHub Pages from `main` / root. It's served on the owner's existing custom domain → **https://brandonconcepcion.com/pawse/**.
Added `.nojekyll` (serve files as-is), `.gitignore`, and an http → https redirect in `index.html` (the domain
doesn't enforce HTTPS, and the service worker and install need it). Commits use the GitHub noreply email so the
owner's work email isn't public.
**Notes:** All app paths are relative, so it works under any path (`/pawse/`, briefly `/dogs/`). Storage is per-origin: the owner's dogs at
`localhost:8642` must be moved with SAVE BACKUP → LOAD BACKUP. Future deploys = push to `main`, and bump `CACHE`.

---

## 2026-10-27: Cleanup pass + agent docs
**What**
- Removed dead code: unused `.px-frame` CSS, the gym's unused `hydrant`/`skyBottom` layout fields, the unused
  `flip` option on `dogSpriteURL`, and the `export` on internal-only `coatOf`, `dogPose`, `ICONS`.
- De-duplicated helpers: `rand`, `pickWeighted`, `disc` now live in `scene.js` (exported) and the gym imports
  them. The gym had three separate pixel-circle copies. `todayISO()` now reuses `isoDate()` from `gym.js`.
- Merged duplicate CSS rules (`.chart-box`, `.stats b`).
- Less wasted work: the gym status line only recomputes when its 4s message slot changes (it was re-filtering
  every weigh-in 4×/second); the gym only computes weight stats for Plump dogs; the tab bar is only rebuilt when the
  remembered area changes.
- Added `AGENTS.md` (entry point), `CLAUDE.md` (imports it), `docs/context/*` (one doc per part), and this log.

**Verified:** `node --check` on all modules; every screen exercised in a private browser tab (park, gym, weigh-in,
stats, log, dogs, tab switching) with no runtime errors.

---

## 2026-10-27: Multiple dogs in the gym
**What:** All dogs appear in the gym (previously only the gym buddy). Equipment is **claimed** per dog
(`GymScene.plan` → `this.claims`) so two dogs never use the same machine. Added a "buddy hangout" behavior (walk
to another dog, sit with ♥). The HUD/stats still track only the gym buddy.
**Files:** `js/gym-scene.js` (`plan`), `js/app.js` (`syncGym`).
**Verified:** 10-minute simulation with two dogs: 0 machine clashes, both used every machine.
**Note:** test data from an earlier private-window session showed up as a duplicate "Cookie". It was test
leftovers, not a bug.

---

## 2026-10-27: More gym machines + Play tab remembers park vs gym
**What**
- New equipment and activities: exercise bike (flywheel spins), bench press (barbell moves), punching bag (swings),
  agility hurdles (jump pose over each), agility tunnel (dog hidden inside). Moved the exercise ball so it
  doesn't overlap the bag.
- `localStorage['pawse.area']` remembers `play`/`gym`/`gymStats`. An empty hash opens the last area, and the first
  tab becomes **GYM** (dumbbell) while in gym mode.
**Files:** `js/gym-scene.js`, `js/app.js` (`lastArea`, `parseRoute`, `render`, `renderTabBar`).
**Bug fixed:** the area constants were declared after `state` (which calls `parseRoute()` at load), so reopening
with no hash hit a temporal-dead-zone error and showed a blank screen. They're now declared above `state`.

---

## 2026-10-27: Cookie + the retro gym + weight/food tracking
**Why:** The owner's second dog, Cookie (all white, ~Teddy's size), needs to lose weight. The owner logs her
weight and food daily and wants to see how weekly food relates to weight change, with the trend going down.
**What**
- New `cookie` coat (white fluffball, pink sweatband) and **Plump** size (`roundOut` belly/back). Plump dogs slim
  on screen as they approach their goal (`gymBuild`: plump → chubby at 50% → small at 100%).
- `GymScene` (extends `ParkScene`): navy wall with 80s stripes, windows, live clock, dumbbell rack, wood floor,
  treadmill, yoga mat, scale, water bowl, kettlebells, exercise ball.
- `js/gym.js` math: Monday-start weekly averages, week-over-week change, pace (% body weight vs 1–2%/week),
  Pearson r between weekly food and weekly weight change, lb/week per +10 g/day, and break-even g/day.
- DB v3: `weights` store (one record per dog per day). Backup format v4 includes weights and `goalWeight`.
- Gym UI: HUD, LOG TODAY sheet (any date, prefill), STATS page (goal, tiles, SVG charts, insight, weekly table,
  daily log).
**Verified:** synthetic 5–6 week datasets where 200 g/day is break-even → estimate ~193–195 g/day, r ≈ 0.94–0.99.
**Note:** Cookie was added to the owner's real data (default browser profile) with her photo; no weights were
added. Units are lb and grams.

---

## 2026-10-27: "WANNA PLAY?" call button
**What:** A button next to START plays the owner's recorded clip (`sounds/wanna-play.mp3`, 1.7s). The park enters a
`calling` phase (dogs show "!" and dash to the front), then the session starts 1s after the clip ends. The clip plays
even with SFX off.
**Also fixed:** a stale cached `sound.js` loaded next to a new `app.js` broke startup during development. The
service worker now fetches with `cache: 'no-cache'` so updates never mix versions.
**Files:** `js/sound.js` (`playCall`), `js/scene.js` (`calling` reaction, `callSpot`, `dash` speed),
`js/app.js` (`actions.call`, `startSession`, `callName`), `sw.js`.

---

## 2026-10-27: Teddy's coat + Small size
**Why:** Make one dog look like the owner's dog Teddy (from a photo): small (~20 lb) fluffy white dog, brown left
ear, brown stripe on the right ear, brown spot on the right thigh near the tail.
**What:** `teddy` coat with fluff (head tuft + beard), cocoa eyes, black nose, no collar. Markings depend on facing:
right-facing shows his left side (brown ear), left-facing shows his right side (striped ear + thigh spot). New
`small` size via `shrink()`.
**Lesson:** test cleanup cleared IndexedDB in the shared browser profile and deleted the owner's real Teddy. He was
re-added (with photo). **Never wipe the owner's data; test in a private window.**

---

## 2026-10-27: Full-screen park, dog behaviors, persistent play log
**What**
- The park became the full-screen background of the Play screen, with floating HUD/setup/controls.
- The agent "brain": per-dog step queues, phase reactions, weighted plans (zoomies, fetch, chase, tricks, naps,
  water breaks), tap-a-dog tricks, emote bubbles, DOM name tags. The sun crosses the sky with session progress.
- DB v2: sessions moved from inside dog records to their own store (with migration). Sessions with no dog selected
  are logged, and ended-early sessions ≥ 60s are logged as "ENDED EARLY". New **LOG** tab: weekly/all-time totals,
  streak, 7-day chart, per-day list with delete.
**Files:** `js/scene.js` (rewrite), `js/pixel.js` (more poses, emotes), `js/db.js` (v2), `js/app.js`.

---

## 2026-10-27: 8-bit redesign
**Why:** The owner wanted an 8-bit look with dogs, nature, a dog park, and a sunny animated day.
**Research takeaways:** a fixed small palette (PICO-8), integer scaling with `image-rendering: pixelated`, pixel
fonts (Press Start 2P + VT323, bundled), NES-style notched borders, low frame rate, stepped/dithered gradients.
Good pixel dog sprites online were paid packs, so all art is drawn in code.
**What:** palette + procedural dog sprites with auto-outline, coats, toy icons, a pixel photo portrait, a sunny park
scene, chiptune SFX with mute, "STAGE CLEAR" celebration, pixel UI system.
**Note:** the pre-redesign version is preserved at `~/Developer/pawse-v1-classic/`.

---

## 2026-10-27: Web app (PWA) instead of native iOS
**Why:** The native SwiftUI app (`~/Developer/Pawse-iOS/`) needs Xcode plus either a $99/yr Apple developer
account or re-installing every 7 days. The owner preferred free, so the app was rebuilt as an installable website.
**What:** vanilla JS app: dog profiles, toys with ratings, play timer (end-timestamp based), IndexedDB storage,
JSON backup/restore, service worker for offline use, iOS home-screen meta. Not yet published; GitHub Pages was
proposed and the owner said "not yet".
