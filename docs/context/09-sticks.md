# Sticks (the reward system): `js/sticks.js` + the Log screen

Dogs collect **sticks** for play, walks and new tricks, and spend them on prizes the owner defines (a treat, a new toy,
a spa day). Sticks are a pixel stick icon (`iconURL('stick')`); the prize icon is `iconURL('gift')`.

## Rates (`RATES` in `sticks.js`)
- **1 stick per full minute of play** (`playSticks(session)`; every pup in a session gets the full amount).
- **3 sticks per 0.1 mile walked** (`walkSticks(walk)` = `round(miles * 10) * 3`; every pup ticked on the walk).
- **50 sticks per new trick** (`RATES.perTrick`).
Change the numbers in `RATES` only (the tip line on the Log screen reads from it).

## Data: earned is calculated, only spending is stored
`stickTotals(dogId, sessions, rewards)` → `{ play, walks, tricks, earned, spent, balance }`. Play comes from the
`sessions` store; the rest from the new **`rewards`** store (IndexedDB v4, key `id`), so editing or deleting a log entry
fixes the total automatically:

```js
// rewards: every record has at (ms), dogIds [], dogNames [] (names kept so history survives deleting a dog)
{ id, type: 'walk',   at, dogIds, dogNames, miles, stravaId? }   // stravaId = imported from Strava (10-strava.md)
{ id, type: 'trick',  at, dogIds: [one], dogNames, name }
{ id, type: 'redeem', at, dogIds: [one], dogNames, prizeName, cost }   // the only record that lowers a balance
// prizes (store `prizes`, key id)
{ id, name, cost }
```
`db.js`: `loadRewards/saveReward/deleteReward`, `loadPrizes/savePrize/deletePrize`. `replaceEverything(dogs, sessions,
weights, rewards, prizes)` clears `rewards` always, but clears `prizes` only when the backup has a prize list (a backup
from before this feature keeps the current prizes). **Backup version 5** adds `rewards` and `prizes`; the importer
validates both.

## Defaults
`DEFAULT_PRIZES` (Special treat 100, New toy 400, Spa day 800) are added once on a device with an empty shop
(`addDefaultPrizes()`, localStorage `pawse.defaultPrizesAdded`), so deleting them sticks. They aren't personal data.
New visitors start with 0 sticks: no walks, tricks or redemptions are ever seeded.

## UI (all in `app.js`, section "Shop"): the **SHOP tab** (`#/shop`, `renderShop()`)
- **STICKS card:** each pup's balance (earned / spent). Tap a pup to make them the active shopper (`shopDogId`, Teddy by
  default). Buttons: **+ WALK** (`openWalkSheet`: tick the pups, miles, date; Teddy ticked by default) and **+ TRICK**
  (`openTrickSheet`: pup, trick name, date).
- **PRIZES FOR <PUP>:** the prize list with the active pup's REDEEM button (disabled with "N MORE" when short; confirms,
  then writes a `redeem` record), an X to remove a prize, and **+ NEW PRIZE** (`openPrizeSheet`).
- **STICK LOG:** the latest 12 walks / tricks / redemptions with an X to delete one.
- **Celebration** after a finished play session shows "+N sticks".
- Actions: `shop-pick`, `log-walk`, `log-trick`, `new-prize`, `redeem`, `delete-prize`, `delete-reward`; forms `walk`, `trick`, `prize`.
- The tab bar is now six tabs (PLAY · GYM · DOGS · TOYS · SHOP · LOG). "MY DOGS" was shortened to "DOGS" so six labels fit a 320px phone.

## Strava
Walks can be imported from Strava: see [10-strava.md](10-strava.md) (the STRAVA button on the SHOP tab).

## Ideas not built yet
Show the balance in the park HUD; a "redeemed new toy" prompt that opens the toy-maker flow; weekly stick goals.
