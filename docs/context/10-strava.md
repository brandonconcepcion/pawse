# Strava sync: `js/strava.js` + `tools/strava-worker/worker.js`

Pulls walks from the owner's Strava into the stick log (see [09-sticks.md](09-sticks.md)). **Free**: Strava's API costs
nothing, and the helper runs on Cloudflare's free Workers plan (100,000 requests/day; a sync uses ~3).

## Why a Worker?
Strava's login needs a **client secret** to trade the login code for tokens, and to refresh tokens (they last 6 hours).
A secret can't live in a static browser app, so `tools/strava-worker/worker.js` (a Cloudflare Worker, ~100 lines) holds it
and forwards four calls: `POST /token`, `POST /refresh`, `POST /deauthorize`, `GET /activities`. It stores nothing, only
answers requests from `ALLOWED_ORIGINS` (+ localhost), and `/activities` still needs the athlete's own bearer token.
`/activities` goes through it too because it's not documented whether Strava allows browser calls directly.

## One-time setup (the owner does this; ~10 minutes)
The owner currently runs Pawse on their laptop (`python3 -m http.server 8642` in the repo → http://localhost:8642), so use
**`localhost`** as the callback domain below (the Worker already allows any `http://localhost:PORT` origin). For the live site, use
`brandonconcepcion.com` and put `https://brandonconcepcion.com` in `ALLOWED_ORIGINS`.
1. **Strava app:** https://www.strava.com/settings/api → create an app (name Pawse; website `http://localhost:8642` or the live
   site; **Authorization Callback Domain** `localhost`). Note the **Client ID** and
   **Client Secret**.
2. **Cloudflare Worker:** sign up free at cloudflare.com → Workers & Pages → Create → Worker (name it `pawse-strava`) → Deploy →
   Edit code → paste all of `tools/strava-worker/worker.js` → Deploy. Then Settings → Variables and Secrets, add:
   `STRAVA_CLIENT_ID` (text), `STRAVA_CLIENT_SECRET` (**secret**), `ALLOWED_ORIGINS` (text) = `https://brandonconcepcion.com`.
   Copy the Worker's URL (`https://pawse-strava.<you>.workers.dev`).
3. **In Pawse:** SHOP tab → **STRAVA** → paste the Client ID and the Worker URL → SAVE → **CONNECT STRAVA** → Allow → you land back
   on the SHOP tab → **SYNC WALKS**.
Never put the client secret in the repo or in the app.

## What the app does
- Setup + tokens live only on the device: localStorage `pawse.strava` `{ clientId, proxy, accessToken, refreshToken, expiresAt,
  lastSync, athlete }`. Not in backups. `pawse.stravaSkipped` = activity ids the owner unticked (never offered again).
- Scope `activity:read_all` (so walks set to "Only Me" are included). Login redirect is `location.origin + location.pathname` with
  `state=pawse`; on load `handleStravaRedirect()` (app.js `init`) trades `?code` for tokens, tidies the URL to `#/shop`, and
  opens the STRAVA sheet.
- **SYNC WALKS** (`fetchStravaWalks`): activities after the last sync (first sync: 30 days) of type Walk / Hike / Run, ≥ 0.1 mile
  (meters ÷ 1609.344, rounded to 0.1), up to 4 pages of 50. Anything already imported (`reward.stravaId`) or skipped is dropped.
- **Review sheet:** a tick box and a "who went" picker per walk (title containing a dog's name picks that pup, both names pick
  Everyone, else the shop's active pup). Ticked walks become `walk` rewards `{ ..., miles, stravaId }` (so sticks follow the
  usual 3 per 0.1 mile); unticked ones are remembered as skipped; `lastSync` then moves forward.
- **DISCONNECT** forgets the tokens on the device and asks Strava to deauthorize. Imported walks stay.

## Testing without Strava
Run a mock of the Worker (same 4 routes, `Access-Control-Allow-Origin` echoing the origin) on another port, save
`{ clientId: '1', proxy: 'http://localhost:PORT' }` through the STRAVA sheet, then open
`/index.html?state=pawse&code=x&scope=read,activity:read_all#/shop` to simulate Strava sending you back. The Worker itself can be
tested in Node 22 by calling `worker.fetch(new Request(...), env)` with `fetch` stubbed.

## Known risks / not built
- **iPhone home-screen app:** the login hops out to Strava and comes back; the home-screen app and Safari keep **separate**
  storage on iOS, so connect from the same place you use Pawse, and check the redirect lands back in the app.
- Strava apps in development mode are limited (I believe to one connected athlete): fine for personal use. Strava's API terms
  also restrict showing athletes' data to other people; Pawse only shows it on the owner's own device.
- No webhooks or auto-sync: it's a manual SYNC WALKS button.
