# Data & backups: `js/db.js`, localStorage, backup files

All data is on the device. Nothing is sent anywhere.

## IndexedDB (`js/db.js`): database `pawse`, `VERSION = 3`

| Store | Key | Index | Record |
|---|---|---|---|
| `dogs` | `id` | (none) | a dog profile (below) |
| `sessions` | `id` | `startedAt` | one play session |
| `weights` | `id` = `${dogId}:${YYYY-MM-DD}` | `dogId` | one dog's weigh-in/food for one day |

### Shapes

```js
// dogs
{ id, name, breed, birthday /* 'YYYY-MM-DD' or '' */, coat /* key of COATS */, size /* regular|small|plump */,
  goalWeight? /* lb */, treat, notes,
  photo /* JPEG data URL, ≤700px */, photoPixel /* 28×28 PNG data URL, rebuilt if missing */,
  createdAt, toys: [{ id, name, kind /* ball|rope|squeaky|plush|chew|frisbee|puzzle|other */, color /* optional TOY_COLORS id */, rating /* 1-5 */, notes, createdAt }],
  defaultToys /* ids of built-in toys already given to this dog (see 08-toys.md) */ }
  // First visit on a device with no dogs: addDefaultDogs() adds Teddy + Cookie (id default-teddy / default-cookie),
  // once (localStorage 'pawse.defaultDogsAdded'). No photos, weights, or sessions are ever seeded.

// sessions
{ id, startedAt, endedAt /* ms */, duration /* seconds actually played */, planned /* seconds */,
  completed /* false = ended early */, dogIds: [], dogNames: [] /* names kept so history survives deleting a dog */ }

// weights (one per dog per day; either field may be missing)
{ id, dogId, date /* local 'YYYY-MM-DD' */, weight? /* lb, 1 decimal */, food? /* grams, integer */ }
```

### API
`loadDogs` (sorted by name), `saveDog`, `deleteDog`, `loadSessions` (newest first), `saveSession`,
`deleteSession`, `loadWeights`, `saveWeight` (upsert by id), `deleteWeight`,
`replaceEverything(dogs, sessions, weights)` (restore), `legacySessions(dogs)` (convert v1 data).
All go through `transact(storeNames, mode, work)`.

### Migrations (`onupgradeneeded`)
- **v1 → v2:** sessions used to live inside each dog (`dog.sessions = [{ startedAt, duration }]`).
  `moveSessionsOutOfDogs` moves them to the `sessions` store, merging dogs that share a `startedAt` into one
  session, then deletes `dog.sessions`.
- **v2 → v3:** added the `weights` store.
- To add v4: bump `VERSION`, create stores/indexes if missing, transform data in the upgrade transaction
  (`request.transaction`), and update import/export below.
- `db.onversionchange` closes the connection so another tab (or a delete) is never blocked.

`app.js → upgradeDogs()` also patches records on load: missing `coat` → `golden`; missing `photoPixel` →
regenerated from `photo`.

## localStorage keys

| Key | Owner | Value |
|---|---|---|
| `pawse.timer` | timer.js | timer snapshot (see play timer doc) |
| `pawse.minutes` | app.js | last chosen session length |
| `pawse.muted` | sound.js | `'1'` when SFX are off |
| `pawse.area` | (retired) | Old: which area the Play tab returned to. No longer read or written; may linger on old devices |
| `pawse.gymDog` | app.js | id of the gym buddy (default: dog named Cookie, else first Plump dog, else first dog) |
| `pawse.installHintDismissed` | app.js | hides the Safari install hint |

## Backups (`app.js` → "Backup" section)

- **Export** (`exportBackup`): JSON `{ app: 'pawse', version: 4, exportedAt, dogs, sessions, weights }`.
  `photoPixel` is stripped (rebuilt on load). Uses the share sheet when available, else a download.
- **Import** (`importBackup`): accepts version 4, older files without `weights`, and v1 files where sessions are
  inside dogs (via `legacySessions`). Validates/cleans every field, confirms, then `replaceEverything`.
- When you add a field or store, update both export and import, and bump the backup `version`.

## Storage durability

`navigator.storage.persist()` is requested at startup. Safari keeps data for home-screen apps; plain Safari
tabs can be evicted after long disuse, which is why the UI nudges users to SAVE BACKUP.
