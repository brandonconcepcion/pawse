# Changelog / dev log

Newest first. Each entry: **what** changed, **why**, **files**, and **notes for the next agent**.
Add an entry for every meaningful change (see `AGENTS.md` → "Keeping the docs alive").

---

## 2026-10-27: Moved to brandonconcepcion.com/dogs
**What:** Renamed the GitHub repo `pawse` → `dogs` so the site lives at **https://brandonconcepcion.com/dogs/**
(GitHub Pages uses the repo name as the path). The app name stays Pawse; the local folder stays `~/Developer/pawse`.
**Also:** the service worker now only deletes its own `pawse-*` caches, since the whole domain shares cache storage.
**Notes:** The old `/pawse/` URL now 404s; it was only live for minutes. GitHub redirects git operations from the
old repo name, but the local remote was updated anyway. All docs updated to the new URL.

---

## 2026-10-27: Published on GitHub Pages
**What:** Public repo `brandonconcepcion/dogs`, GitHub Pages from `main` / root. It's served on the owner's existing custom domain → **https://brandonconcepcion.com/dogs/**.
Added `.nojekyll` (serve files as-is), `.gitignore`, and an http → https redirect in `index.html` (the domain
doesn't enforce HTTPS, and the service worker and install need it). Commits use the GitHub noreply email so the
owner's work email isn't public.
**Notes:** All app paths are relative, so it works under `/dogs/`. Storage is per-origin: the owner's dogs at
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
