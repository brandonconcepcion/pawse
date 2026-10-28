# Park scene & the dog "brain": `js/scene.js`

`ParkScene` draws the full-screen park and runs every dog's behavior. `GymScene` extends it
([06-gym.md](06-gym.md)), so the behavior engine here is shared.

```js
new ParkScene(canvas, labelLayer, getState)   // getState() → { phase, progress }
```

## Canvas & layout
- `resize()`: scale = 3 if the window is < 700px wide, else 4. Logical size `W × H` = window / scale.
  Calls `layout()` (overridable: horizon, props), `buildLandscape()` (static offscreen layer), and `updateYard()`.
- The park and gym **share one canvas** (`#park`). `start()` shows it, re-runs `resize()` if the viewport
  changed while hidden, and starts a `requestAnimationFrame` loop throttled to **12 FPS** (`FPS`). `stop()` hides
  the canvas and labels.
- `setInsets(top, bottom)` (CSS px covered by panels) → `updateYard()` computes the walkable rectangle
  `this.yard` and clamps dogs into it.

## Phases (from `getState`)
`idle`, `running`, `paused`, `finished` (timer) and `calling` (the "wanna play?" button). The progress value
(0..1) moves the sun across the sky.

## Agents (one per dog)
`setDogs([{ id, name, coat, size, mascot? }])` keeps existing agents where they are, adds new ones at random
spots, removes missing ones, and rebuilds the DOM name tags (mascots get no tag).

Agent fields: `x, y` (top-left of the 18×14 sprite), `dir` (1 = right), `queue` (upcoming steps), `step`
(current), `emote` + `emoteUntil`, `hasBall`, `phaseSeen`, `seed` (animation offset).

### Steps
A dog always works through a queue of **steps**:
- **Stationary:** `{ pose, t /* seconds */, emote?, spin? }`. `spin` flips direction rapidly (chasing its tail).
- **Moving:** `{ to, speed /* walk|sniff|run|dash */, limit? /* give up after s */, onArrive?, emote? }`.
  `to` is a point `{x, y}`, a named target resolved by `resolveTarget()` (`'ball'`, `'bowl'`, gym equipment…), or
  `{ dog: id }` (follow another dog).
- Extra flags (e.g. `onTreadmill`, `hurdles`) are just markers that drawing code reads.

### Each frame: `update(dt, now)`
1. If the phase changed since the dog last looked → `queue = reaction(agent)` (e.g. "!" and jump on start,
   drink on pause, everyone dashes to `callSpot()` when calling).
2. If no current step → take the next from the queue; if the queue is empty → `queue = plan(agent)`.
3. `runStep()` moves toward the target (`SPEED` px/s) or counts down `t`.

`plan()` picks weighted options per phase with `pickWeighted([[weight, () => steps], …])`. In the park:
zoomies, fetch (`fetchPlan`: grab ball → carry → drop), chase another dog, roll over, spin, beg, play bow, jump,
sniff, wag. Idle is calmer (wag, lie, sleep, wander, drink). Paused heads to the water bowl.

`poseOf(agent, now)` turns the step into a sprite pose + frame (moving: run/walk/sniff frames at 12/6 FPS).

**Tap a dog:** `pokeAt(clientX, clientY)` finds the dog under the finger, drops the ball if held, and replaces its
queue with a random `trick()`.

## Drawing (`draw(now)`)
Sky (stepped bands with dithered seams) → sun (arc by progress, kept below the HUD) → clouds → birds →
static landscape (hills, trees, mowed grass, picket fence, doghouse) → swaying flowers → **sorted by baseline y**:
bowl, hydrant, ball, dogs → emote bubbles → butterflies → `placeLabels()` (DOM name tags).

## Shared helpers (exported)
`rand(min, max)`, `pickWeighted(options)`, `disc(ctx, cx, cy, r, color)` (filled pixel circle). Used by the gym.

## Extending
- **New behavior:** add a `[weight, () => steps]` option to `plan()` for the right phase. If it needs a place,
  add a named target in `resolveTarget()`.
- **New prop:** set its position in `layout()`, draw it in `draw()`'s sorted list (`{ y: baseline, draw }`), or in
  `buildLandscape()` if it never moves.
- Keep motion choppy (12 FPS) and positions on whole pixels (`Math.round`) to stay 8-bit.
