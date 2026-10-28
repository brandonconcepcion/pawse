# Play timer & sound: `js/timer.js`, `js/sound.js`, play flow in `app.js`

## Timer (`js/timer.js`)

Singleton `timer` (class `PlayTimer`). Time is tracked as an **end timestamp**, not a ticking counter, so it
stays correct when the app is backgrounded, the phone locks, or the page reloads.

State (persisted to `localStorage['pawse.timer']` on every change):

| Field | Meaning |
|---|---|
| `phase` | `idle` → `running` ⇄ `paused` → `finished` → (`reset()`) `idle` |
| `total` | session length in seconds |
| `endAt` | ms timestamp when a running session ends |
| `pausedRemaining` | seconds left while paused |
| `startedAt` | ms timestamp the session started (used for the log) |
| `selected` | dog ids chosen on the setup panel ("WHO'S PLAYING?") |
| `playing`, `playingNames` | dogs in the current/just-finished session (names kept for the log) |

API: `start(minutes, dogs)`, `playAgain()`, `pause()`, `resume()`, `reset()`, `tick()` (returns true exactly
once when the session ends), `remaining()`, `progress()` (0..1), `toggleSelected(id)`, `forgetDog(id)`.

## Play flow (`app.js`, "Play screen" + "Celebration" sections)

1. **Setup (idle):** pick dogs (chips), minutes (− / + or presets 5–45, max 120), then
   **START** or **WANNA PLAY?**.
2. `startSession()`: unlock audio, start jingle, wake lock, `timer.start(...)`.
3. **Running:** the 250ms clock calls `timer.tick()` and `updateHUD()` (time, 20-segment bar, rotating status
   messages). The park scene reads `{ phase, progress }` each frame.
4. **END early:** if ≥ 60s were played (`MIN_LOGGED_SECONDS`) the session is logged with `completed: false`,
   otherwise it's discarded after a confirm.
5. **Finished:** `onTimerFinished()` → `logSession({ completed: true })`, chime, vibrate, "STAGE CLEAR"
   overlay (`showCelebration`). DONE → `timer.reset()`. PLAY AGAIN → `timer.playAgain()`.
6. If the app was closed and the session ended meanwhile, `init()` calls `tick()` and celebrates/logs on open.

### "WANNA PLAY?" call
`actions.call`: sets `state.calling = true` (park shows the `calling` phase: dogs get a "!" and dash to the
front of the yard) → `await playCall()` (the MP3) → wait 1s → `startSession()`. The status line says
"HEY <NAME>!" via `callName()`.

## Sound (`js/sound.js`)

- **Web Audio chiptunes** (square/triangle oscillators): `playBlip(high)`, `playStart()`, `playChime()`
  (stage-clear jingle, plays twice). These respect **SFX ON/OFF** (`localStorage['pawse.muted']`).
- iPhones only allow audio after a user gesture: `unlockAudio()` creates/resumes the `AudioContext` and plays a
  silent blip. Call it inside tap handlers before any sound.
- **`playCall()`** plays `sounds/wanna-play.mp3` through an `<audio>` element (normal media playback). It plays
  **even when SFX is off** because the user explicitly asked for it. Resolves when the clip ends, with a 6s fallback
  so the flow never hangs.
- To change the call: replace `sounds/wanna-play.mp3` (same name) and bump `CACHE` in `sw.js`.

## Gotchas

- Web Audio on iOS is silenced by the ringer switch; `<audio>` media generally isn't. Not yet verified on device.
- Wake lock (`navigator.wakeLock`) keeps the screen on while running; released on pause/end/finish and
  re-requested when the app becomes visible again.
- Web apps can't alert while the phone is locked, so there are no push/local notifications.
