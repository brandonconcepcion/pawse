# App shell: `index.html` + `js/app.js`

`app.js` is the whole UI layer: routing, every screen, sheets (modal forms), event handling, the play log,
the gym UI, and backups. It imports everything else. Sections are marked with banner comments
(`// ----` + a title), so grep for a section name to jump there:

| Section (banner title) | What's in it |
|---|---|
| Constants & helpers | `escapeHTML`, `newId`, `formatClock`, `formatDuration`, `ageOf`, `todayISO`, `avatar`, `pixelImg`, `bones`, `resizePhoto` |
| Play log math | `totalSeconds`, `sessionsFor`, `since`, `dayStreak`, `dayLabel` |
| App state & routing | `state`, the two scenes, `parseRoute`, `render`, remembered "area" |
| Play screen | `parkDogs`, `syncScene`, `measureInsets`, `renderPlay`, `updateHUD`, `startSession`, `logSession`, `onTimerFinished`, wake lock |
| Celebration | `showCelebration` ("STAGE CLEAR" overlay) |
| My Dogs | `renderDogList`, `renderDogProfile` |
| Play log | `renderLog`, `backupBox` |
| Toy wall | `toyWallDog`, `shelfLayout`, `renderToys`, `shelfStyle`, `openToyViewer` (spinning toy) |
| Sheets (dog & toy editors) | `openSheet`/`closeSheet`, `openDogEditor`, `openToyEditor`, `submitDog`, `submitToy`, `refreshDogPreviews`, `refreshToyPreview` |
| Backup | `exportBackup`, `importBackup`, `upgradeDogs`, `loadAll` |
| Gym (+ "Stats page") | see [06-gym.md](06-gym.md) |
| Event handling | the `actions` map + click/change/submit delegation |
| Install hint / Start up | Safari "Add to Home Screen" hint, `renderTabBar`, `init` |

## Page structure (`index.html`)

```
<canvas id="park">        full-screen scene canvas (shared by park + gym), hidden on other screens
<div id="dog-labels">     DOM name tags positioned over dogs each frame
<main id="view">          current screen, re-rendered as innerHTML
<nav class="tabbar">      PLAY/GYM · MY DOGS · TOYS · LOG (built by renderTabBar)
<div id="overlay">        sheets (forms) and the celebration screen
```

## Routing

Hash-based. `parseRoute()` → `{ name, id? }`:

| Hash | Route name | Screen |
|---|---|---|
| `#/play` | `play` | Park + timer (immersive) |
| `#/gym` | `gym` | Gym (immersive) |
| `#/gym/stats` | `gymStats` | Gym charts & settings |
| `#/dogs` | `dogs` | Dog list |
| `#/dogs/<id>` | `dog` | Dog profile |
| `#/log` | `log` | Play log |
| `#/toys` | `toys` | Shared toy wall (see [08-toys.md](08-toys.md)) |
| (empty) | `toys` | **The landing page is the Toy Wall.** Exception: if a play timer is running or paused, it opens `play` (the park, where the timer is). |

`render()` is the single entry point. It records the area, updates the tab bar, toggles `body.immersive`,
starts/stops the right scene, and calls the screen's `render*()` function. `hashchange` → `render()`.

The first tab is **PLAY** (paw) or **GYM** (dumbbell) depending on the remembered area (`localStorage['pawse.area']`),
so switching tabs and coming back returns you to the gym. (The remembered area no longer decides the landing page.) `renderTabBar()` only rebuilds when that area changes.

## State

```js
state = { dogs, sessions, weights, route, calling }
```
- `dogs`, `sessions`, `weights` are in-memory copies of the IndexedDB stores, loaded by `loadAll()` at startup.
  Every write goes to the DB and updates `state` (no re-fetch).
- `calling`: true while the "wanna play?" clip plays (the park scene shows the `calling` phase).
- The play timer lives in `js/timer.js` (singleton `timer`).
- Small preferences live in localStorage (keys in [03-data-and-backups.md](03-data-and-backups.md)).

## Rendering & events

- Screens are template strings assigned to `$view.innerHTML`. Always pass user text through `escapeHTML`.
- **Clicks:** any element with `data-action="name"` calls `actions[name](el)`, with extra data in `data-*`
  attributes. One delegated listener on `#view` and one on `#overlay`.
- **Forms:** `<form data-form="dog|toy|weight">` → `submitDog` / `submitToy` / `submitWeight` on submit.
- **Change events:** `photo` (pick + pixelate), `import` (restore backup), `coat`/`size` (refresh editor
  previews), `kind`/`color` in the toy editor (refresh the 3D preview), `date` in the weight sheet (prefill that day), `gym-dog` (switch gym buddy).
- Sheets: `openSheet(html)` renders a backdrop + bottom sheet into `#overlay`; `sheetBar(title)` gives the
  CANCEL / title / SAVE row.

### Adding a screen
1. Add a route in `parseRoute` and a branch in `render()`.
2. Write `renderX()` that fills `$view`.
3. Add any buttons as `data-action` entries in `actions`.
4. Link to it (tab bar or a button), and bump `CACHE` in `sw.js`.

## Immersive screens (park & gym)

`body.immersive` hides the page background and shows `#park`. `#view` sits on top with
`pointer-events: none`, except the panels (`.page-header > *`, `.hud`, `.play-bottom > *`), so taps on the
open scene reach the canvas (tap a dog → trick). Layout:
- `.play-top`: header + HUD box at the top.
- `.play-bottom`: fixed above the tab bar (setup panel + controls).

`measureInsets()` tells the active scene how much of the screen the panels cover, so dogs roam in the visible
gap. On wide screens (≥700px) only the tab bar counts, so dogs can use the whole floor around the centered panels.

## Timers & loops

- One `setInterval(…, 250)` drives everything time-based outside the scenes: `timer.tick()` (detect finish),
  `updateHUD()` on the park, `updateGymStatus()` on the gym. Both updaters skip work when nothing changed.
- Scenes run their own `requestAnimationFrame` loop at 12 FPS (see [05-park-scene.md](05-park-scene.md)).
- `visibilitychange`: when the app comes back, check whether the timer finished while it was hidden.

## Gotchas

- `lastArea`/`AREA_*` must be declared **before** `state` (which calls `parseRoute()` at load). Moving them
  below once caused a blank screen.
- `todayISO()` is local-date `YYYY-MM-DD` (via `isoDate` from `gym.js`). Never use `toISOString()` for days:
  it's UTC and shifts dates in the evening.
