# Pawse: agent guide

Start here. This file is the map. Each main part of the code has a deeper context doc in
[`docs/context/`](docs/context/), and [`docs/CHANGELOG.md`](docs/CHANGELOG.md) records what was built,
when, and why. **Update both when you change something** (see "Keeping the docs alive" below).

## What this is

Pawse is an 8-bit dog app that runs as an installable website (PWA) on the owner's iPhone. It has two dogs:

- **Teddy**: small fluffy white dog, brown left ear, brown stripe on the right ear, brown spot on the
  right thigh near the tail. Uses the `teddy` coat and `small` size.
- **Cookie**: all-white fluffy dog who is on a diet. Uses the `cookie` coat (pink sweatband) and `plump` size.
  She's the default gym buddy whose weight and food are tracked.

Main features:
1. **Park (Play tab):** a full-screen animated pixel dog park plus a play-session countdown timer. Dogs roam and
   pick behaviors. There's a "WANNA PLAY?" button that plays a recorded clip, then starts a session.
2. **Gym:** a full-screen retro gym where all dogs work out, plus daily weight (lb) and food (g) tracking with
   stats and food-vs-weight analysis.
3. **My Dogs:** profiles, pixel coats and sizes, photos (shown as pixel portraits), favorite toys.
4. **Log:** history of every play session.

Everything is stored on the device (IndexedDB + localStorage). There is no server, account, or build step.

## Live site

https://brandonconcepcion.com/pawse/ (source: https://github.com/brandonconcepcion/pawse)

## Run it

```sh
cd ~/Developer/pawse
python3 -m http.server 8642     # then open http://localhost:8642
```

Plain HTML/CSS/JS with native ES modules. No npm, no bundler. Syntax-check a file with `node --check js/app.js`.

## File map

| File | What it owns | Context doc |
|---|---|---|
| `index.html` | Page shell: `#park` canvas, `#dog-labels`, `#view`, tab bar, `#overlay` | [app shell](docs/context/01-app-shell.md) |
| `js/app.js` | Routing, every screen, forms/sheets, event handling, play log, gym UI, backups | [app shell](docs/context/01-app-shell.md), [gym](docs/context/06-gym.md) |
| `js/timer.js` | Play countdown state machine (survives reloads) | [play timer & sound](docs/context/02-play-timer-and-sound.md) |
| `js/sound.js` | Chiptune SFX + the recorded "wanna play?" clip | [play timer & sound](docs/context/02-play-timer-and-sound.md) |
| `js/db.js` | IndexedDB schema, migrations, CRUD | [data & backups](docs/context/03-data-and-backups.md) |
| `js/pixel.js` | Palette, dog sprites (poses, coats, sizes), icons, emotes, photo pixelation | [pixel art](docs/context/04-pixel-art.md) |
| `js/scene.js` | `ParkScene`: full-screen park + the dog "brain" shared by both scenes | [park scene](docs/context/05-park-scene.md) |
| `js/gym-scene.js` | `GymScene extends ParkScene`: gym room, equipment, activities | [gym](docs/context/06-gym.md) |
| `js/gym.js` | Pure math: weekly averages, pace, food-vs-weight correlation | [gym](docs/context/06-gym.md) |
| `styles.css` | The whole 8-bit UI system | [PWA, offline & styles](docs/context/07-pwa-offline-and-styles.md) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen install | [PWA, offline & styles](docs/context/07-pwa-offline-and-styles.md) |
| `fonts/`, `sounds/` | Press Start 2P + VT323 (OFL), `wanna-play.mp3` | [PWA, offline & styles](docs/context/07-pwa-offline-and-styles.md) |

## Rules of the road

- **Never wipe the owner's data.** Their real dogs (Teddy, Cookie) live in the browser's storage at
  `localhost:8642` (default profile). Do throwaway testing in a **private/incognito** window, or delete only the
  records you created. Clearing IndexedDB "as cleanup" once deleted Teddy.
- **Adding/renaming a file?** Add it to `ASSETS` in `sw.js`. **Changing any file?** Bump `CACHE` in `sw.js`
  (`pawse-vN`) so installed copies refresh.
- **Schema change?** Bump `VERSION` in `js/db.js`, add an upgrade step in `onupgradeneeded`, and update the
  backup export/import in `app.js` (see the data doc).
- **Stale modules during dev:** browsers can cache an old `.js` module next to a new one, which causes errors like
  "does not provide an export named …". Hard-refresh, or in the page run
  `for (const f of [...]) await fetch(f, { cache: 'reload' })` before reloading.
- **Pixel art stays crisp:** draw at 1 unit = 1 pixel on low-res canvases and scale by whole numbers with
  `image-rendering: pixelated`. When showing a sprite `<img>`, use an integer multiple of its size.
- **Colors** come from the PICO-8 palette in `C` (`js/pixel.js`), plus a few named extras. Don't hard-code new
  colors in random places; add them to `C`.
- **Style:** match the surrounding code: small functions, short "why" comments, template-string rendering,
  `data-action` buttons.
- **User-facing copy** is short and friendly. Units: weight in **lb**, food in **grams**.

## Keeping the docs alive

After any meaningful change:
1. Add a dated entry to the top of [`docs/CHANGELOG.md`](docs/CHANGELOG.md): what changed, why, files touched,
   and anything the next agent should know.
2. Update the matching `docs/context/*.md` if behavior, data shapes, or extension steps changed.
3. Update the user-facing [`README.md`](README.md) if features changed.

## Related folders (outside this repo)

- `~/Developer/pawse-v1-classic/`: snapshot of the web app before the 8-bit redesign.
- `~/Developer/Pawse-iOS/`: an earlier native SwiftUI version, shelved because installing it needs a paid Apple
  developer account (or a free one that expires every 7 days).

## Not done yet / ideas

- Published at **https://brandonconcepcion.com/pawse/** (GitHub Pages, public repo `brandonconcepcion/pawse`, deployed from `main` /
  root). Pushing to `main` redeploys in about a minute, so **bump `CACHE` in `sw.js` with every change** or installed
  copies may keep old files. `.nojekyll` makes Pages serve files as-is.
- The owner's GitHub user site has the custom domain **brandonconcepcion.com**, so project pages live under it
  (`brandonconcepcion.github.io/pawse` redirects there). HTTPS works (certificate approved) but "Enforce
  HTTPS" is off for the owner's whole site, so `index.html` redirects http → https itself. Don't change the
  owner's site-wide settings without asking.
- Each origin has its own storage: data saved at `localhost:8642` is **not** on the published site. Move it
  with SAVE BACKUP → LOAD BACKUP.
- Not tested on a real iPhone yet (audio, wake lock, install flow).
- `js/app.js` is large (~1,600 lines). If it grows further, split screens into modules (e.g. `screens/gym.js`)
  with shared helpers in a `ui.js`.
- Web apps can't alert while the phone is locked. The app keeps the screen awake during play instead.
