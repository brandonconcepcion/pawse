# Gym: `js/gym-scene.js`, `js/gym.js`, gym UI in `app.js`

The gym is a second immersive area (route `#/gym`) where **all dogs** work out, plus a weight-loss tracker
for one **gym buddy** (default: Cookie). Reached from the **GYM** tab at the bottom (it used to be a button in the park header).

## Scene: `GymScene extends ParkScene` (`js/gym-scene.js`)

Reuses the park's agent engine (queues, movement, emotes, labels, tap-for-trick). Overrides:

- `layout()`: wall height = 46% of the screen (windows clear the HUD), floor below. Positions for
  `treadmill, mat, weighScale, bowl, kettlebells, exerciseBall, bike, bench, bag, hurdles[2], tunnel`, all
  relative to `W` and `groundTop`.
- `reaction()` → `[]` (the gym has no timer phases; `getState` returns `{ phase: 'gym' }`).
- `plan(agent)`: weighted activities. Equipment options carry a **machine key** and are **claimed** in
  `this.claims` (machine → agent id) so two dogs never share a machine. A dog's claims are released when it plans
  again (or if it left the gym). Activities:

  | Activity | Steps (flags read by drawing) |
  |---|---|
  | Treadmill | walk to `treadmill` → `run` in place (`onTreadmill`, belt moves) |
  | Exercise bike | `bike` → `sit` on the seat (`onBike`, flywheel + crank spin) |
  | Bench press | `bench` → `lie` (`onBench`, barbell moves up/down above her) |
  | Punching bag | `bag` → `beg` facing left (`onBag`, bag swings) |
  | Agility hurdles | `hurdleStart` → run to `hurdleEnd` (`hurdles`: `poseOf` switches to `jump` over each hurdle) |
  | Agility tunnel | `tunnelStart` → run to `tunnelEnd` (tunnel is drawn after the dog, hiding her inside) |
  | Yoga mat | `mat` → `bow` ("downward dog") → `lie` |
  | Scale / water bowl | sit on the scale / sniff at the bowl |
  | Buddy hangout | walk to another dog → sit with a ♥ |
  | Misc | wander, sniff, nap (zzz), jump, beg |

- `resolveTarget()` adds the named spots above; `runStep()` turns the dog to face the equipment on arrival.
- Drawing: static wall/floor in `buildLandscape()` (navy wall, 80s stripes, sunny windows, dumbbell rack, wood
  planks). Per frame: real-time clock, mat + scale (floor decals), then everything sorted by baseline y, then the
  barbell overlay. Each machine has a `draw*()` method that takes `t` and a "busy" boolean.

## Math (`js/gym.js`, pure functions, testable in Node)

- `isoDate(date)`, `toDate(iso)` (noon local, DST-safe), `weekOf(iso)` → Monday of that week.
- `weeklySummary(entries)` → per Monday-start week: `avgWeight`, `avgFood` (mean of logged days), counts, and
  `change` = avgWeight − previous week's avgWeight (**only if the previous calendar week has data**).
- `foodVsWeight(weeks)`: needs **≥3 weeks** with both `avgFood` and `change`. Pearson **r** between weekly
  food and weekly weight change, plus a linear fit: `slopePer10g` (lb/week per +10 g/day) and `steadyFood`
  (g/day where predicted change = 0; only when the slope is positive and the result is plausible). Verdicts: `strong`
  (r ≥ 0.5), `some` (≥ 0.2), `none` (> −0.2), `opposite`.
- `recentPace(weeks)`: mean weekly change over the last 3 weeks with a change, plus % of body weight.
- `goalProgress(start, current, goal)` → 0..1 (start = first weigh-in), or `null`.

Sanity test used during development: synthetic data where 200 g/day is the true break-even estimated
~193–195 g/day with r ≈ 0.94–0.99.

## UI (`app.js` → "Gym" + "Stats page" sections)

- `gymDog()`: buddy = `localStorage['pawse.gymDog']` → dog named "cookie" → first `plump` dog → first dog.
- `gymStats(dog)`: entries, weeks, latest/start weigh-ins, goal, today's entry, 7-day averages, this week's
  change, progress, pace, food-vs-weight.
- `gymBuild(dog)`: **Plump dogs slim down on screen with progress**: < 50% → `plump`, < 100% → `chubby`,
  goal reached → `small`. Other dogs keep their own size.
- `syncGym()`: every dog → `gymScene.setDogs` (mascot if there are no dogs).
- `renderGym()`: HUD (buddy name, latest weight + change vs last week, food today + 7-day avg, goal bar) and
  **LOG TODAY / EDIT TODAY**. `updateGymStatus()` rotates motivational lines every 4s and reminds about
  today's weigh-in.
- `renderGymStats()`: buddy picker, goal weight (saved as `dog.goalWeight`), summary tiles, two SVG charts (last
  56 days: weight dots + weekly average line + dashed goal; food bars + weekly average), the food-vs-weight
  insight + pace (vs. the 1–2%/week guideline, "check with your vet"), a week-by-week table, and the daily log
  (tap a row to edit).
- `openWeightLog(dog, date)`: date (max today), weight (lb), food (g). Changing the date prefills that day.
  Either value may be blank. `submitWeight` validates (weight ≤ 300, food ≤ 5000), rounds, and upserts.

## Extending
- **New machine:** position in `layout()`, a `draw*()` method + entry in `draw()`'s sorted list, a named target in
  `resolveTarget()`, facing in `runStep()`, and a `plan()` option with a unique machine key.
- **New metric:** add a pure function to `gym.js` (verify it in Node with synthetic data), compute it in
  `gymStats`, show it in `renderGymStats`.
