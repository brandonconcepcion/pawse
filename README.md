# Pawse 🐶

An 8-bit dog park play timer, plus a profile for each of your pups. It's a website that installs on your iPhone's home screen like an app. It's free, there's no App Store, and it works offline.

- **Play**: the whole screen is a sunny pixel dog park, with your dogs roaming the yard. Pick who's playing and for how long, then press **START**. While the timer runs, each dog decides what to do: zoomies, fetching the ball, chasing each other, sniffing, play bows, begging, rolling over, spinning, jumping. They react when you start, pause (everyone heads to the water bowl), and finish. The sun crosses the sky as time passes. **Tap a dog** to make it do a trick. Press **WANNA PLAY?** to play your recorded call (`sounds/wanna-play.mp3`): the dogs perk up, dash over to you, and the session starts when the call ends.
- **My Dogs**: photo (shown as a pixel portrait), a pixel coat for their sprite (including **Teddy**, fluffy white with his brown ear, ear stripe, and thigh spot, and **Cookie**, an all-white fluffball in a pink sweatband), a size (Regular, Small, or Plump), breed, birthday, favorite treat, notes, favorite toys (rated 1–5 bones), and play stats.
- **Gym**: tap **GYM** on the Play screen to visit a retro 8-bit gym where all your dogs work out together (taking turns on the equipment, and stopping to hang out with each other): treadmill, exercise bike, bench press, punching bag, agility hurdles and tunnel, yoga mat, scale, and water bowl. The Play tab remembers whether you were last at the park or the gym (even after closing the app); use **◀ PARK** to head back outside. The panel up top tracks your training buddy (Cookie by default; change it in STATS). Log her **weight (lb)** and **food (g)** each day. **STATS** shows 8-week charts, week-by-week averages, her pace vs. the 1–2%/week guideline, and how weekly food relates to weekly weight change (after 3 weeks of logs), including roughly how many grams a day keeps her steady. Dogs set to the **Plump** size slim down on screen as they near their goal weight.
- **Log**: every play session is saved: who played, when, and for how long. Shows this week's total, all-time total, a day streak, and a 7-day chart. Sessions you end early are saved too (if they lasted at least a minute), marked **ENDED EARLY**.

## The 8-bit look

- Colors come from the 16-color [PICO-8 palette](https://lospec.com/palette-list/pico-8), plus a few sky blues.
- Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) for titles and buttons, [VT323](https://fonts.google.com/specimen/VT323) for body text. Both are bundled in `fonts/` under the SIL Open Font License.
- All art (dogs, park, toys) is drawn in code in `js/pixel.js` and `js/scene.js` at low resolution, then scaled up with crisp pixels. There are no image assets to license.
- Animation runs at 12 frames per second on purpose, so it feels like an old console.
- Sounds are square-wave chiptunes made live in the browser (`js/sound.js`). Toggle them with **SFX ON/OFF**.

**Live at https://brandonconcepcion.github.io/pawse/**

## Install on your iPhone

1. Open **https://brandonconcepcion.github.io/pawse/** in **Safari**.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Open Pawse from your home screen.

## Good to know

- **Your data stays on your phone.** Nothing is uploaded anywhere. Use **Save Backup** (on My Dogs or Log) now and then (save it to Files or AirDrop it to yourself). If you ever delete the app, **Load Backup** brings your dogs and full play log back.
- **Keep Pawse open during play.** The screen stays awake while the timer runs. If you leave the app, the timer still keeps correct time, and the celebration and log happen when you come back. Web apps can't alert you while the phone is locked.
- **Hearing the chime:** the ringer switch needs to be on (not silent), and the volume up.

## Project layout

```
AGENTS.md / CLAUDE.md  Start here if you're an agent working on the code
docs/                 Context docs per part + CHANGELOG
index.html            Page shell, tab bar
styles.css            All styling
js/app.js             Screens, buttons, play log, celebration, backups
js/scene.js           The full-screen dog park and each dog's behavior
js/gym-scene.js       The retro gym (reuses the park's dog behavior)
js/gym.js             Weekly averages, pace, and food-vs-weight math
js/pixel.js           Palette, dog sprites, toy icons, pixel photo portraits
fonts/                Pixel fonts + licenses
sounds/wanna-play.mp3 Your "wanna play?" call (swap in any MP3 with the same name)
js/timer.js           Play timer (saved so it survives closing the app)
js/db.js              Saving dogs, play sessions, and weigh-ins on the device (IndexedDB)
js/sound.js           Chiptune sound effects
sw.js                 Offline support. Bump CACHE when adding files.
manifest.webmanifest  Home-screen name, icon, colors
icons/                App icons
```

**For developers / AI agents:** start with [`AGENTS.md`](AGENTS.md). Each main part of the code has a context doc in [`docs/context/`](docs/context/), and [`docs/CHANGELOG.md`](docs/CHANGELOG.md) is a dated log of every change.

To run it on your Mac: `python3 -m http.server 8642` in this folder, then open http://localhost:8642.
