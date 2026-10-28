# PWA, offline & styles: `sw.js`, `manifest.webmanifest`, `index.html`, `styles.css`, assets

## Install & offline
- `manifest.webmanifest`: name, standalone display, portrait, sky-blue theme, icons (`icons/icon-192.png`,
  `icon-512.png` (also maskable), `apple-touch-icon.png` for iOS). The icon came from the original dog-in-a-timer-ring
  art.
- `index.html`: iOS web-app meta tags, preloads both fonts, loads `js/app.js` as a module.
- `sw.js` (service worker):
  - `install`: caches everything in `ASSETS` under `CACHE` (`pawse-vN`).
  - `activate`: deletes old caches.
  - `fetch`: **network first with `cache: 'no-cache'`** (always revalidate, so an update never mixes old and new
    modules), falling back to the cache when offline (then to `index.html`).
  - **When you add a file, list it in `ASSETS`. When you change anything, bump `CACHE`.**
- Installing on iPhone: open the site in Safari → Share → Add to Home Screen (the app shows a hint banner in Safari).

## Assets
- `fonts/PressStart2P.woff2` (titles, buttons, labels) and `fonts/VT323.woff2` (body text), both SIL OFL,
  licenses in `fonts/`. Latin subset only: characters like ★ or ♪ don't exist in these fonts, so use pixel icons
  (`iconURL('star')`) instead.
- `sounds/wanna-play.mp3`: the owner's recorded call (1.7s TTS clip).

## Styles (`styles.css`)

Design tokens in `:root`: PICO-8 colors (`--ink` = navy, `--cream`, `--green`, …), `--px: 4px` (pixel border
size), `--tabbar-h`, and the two font stacks. Light theme only (always a sunny day).

Building blocks:
- `.px-box`: cream panel with a notched pixel border (four `box-shadow`s, no `border`).
- `.px-btn`: beveled pixel button. Variants: `.go` (green), `.warn` (orange), `.danger` (red); sizes `.big`,
  `.small`, `.tiny`, `.square`. Pressed state shifts down 2px and inverts the bevel.
- `.px-img`: `image-rendering: pixelated` for sprite `<img>`s. `.avatar` is a square pixel-bordered portrait.
- `.label`: small pixel-font caps. `.muted`: slate text.
- Animations use `steps()` timing so they move like sprites.

Layout areas:
- **Immersive** (`body.immersive`): `#park` full screen; `.play-top` (header + `.hud`) and fixed `.play-bottom`
  above the tab bar; pointer events only on panels.
- Regular pages: stepped-sky body background (`body::before`) with a grass strip at the bottom.
- Sheets: `.backdrop` + `.sheet` (slides up), `.sheet-bar`, `.group` + `.field` form rows, `.pick` grids
  (coat/size/toy kind), `.rating` bones.
- Gym-specific: `.gym-hud`, `.gym-stats`, `.chart-svg` (SVG charts with `shape-rendering: crispEdges`),
  `.week-table`, `.entry-row`, `.insight`.

Inputs use VT323 at 22–24px, which keeps iOS from zooming into fields (it zooms below 16px).
