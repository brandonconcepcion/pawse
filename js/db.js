// Everything is saved in the browser's IndexedDB, on this device only.
//   dogs:     one record per dog (profile + toys)
//   sessions: one record per play session (who played, when, for how long)
//   weights:  one record per dog per day (body weight in lb, food in grams)
//   rewards:  walks, new tricks and prize redemptions (see sticks.js)
//   prizes:   the Prize Shop's list of things sticks can buy

const DB_NAME = 'pawse';
const VERSION = 4;

let dbPromise;

function openDB() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('dogs')) db.createObjectStore('dogs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
      }
      if (!db.objectStoreNames.contains('weights')) {
        db.createObjectStore('weights', { keyPath: 'id' }).createIndex('dogId', 'dogId');
      }
      if (!db.objectStoreNames.contains('rewards')) db.createObjectStore('rewards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('prizes')) db.createObjectStore('prizes', { keyPath: 'id' });
      if (event.oldVersion === 1) moveSessionsOutOfDogs(request.transaction);
    };
    request.onsuccess = () => {
      const db = request.result;
      // If another copy of Pawse needs the database (e.g. after an update), let go of it.
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Version 1 kept sessions inside each dog. Version 2 gives them their own store. */
function moveSessionsOutOfDogs(tx) {
  const sessions = tx.objectStore('sessions');
  const merged = new Map();
  tx.objectStore('dogs').openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      for (const session of merged.values()) sessions.put(session);
      return;
    }
    const dog = cursor.value;
    for (const session of legacySessions([dog])) {
      const existing = merged.get(session.id);
      if (existing) {
        existing.dogIds.push(...session.dogIds);
        existing.dogNames.push(...session.dogNames);
      } else {
        merged.set(session.id, session);
      }
    }
    delete dog.sessions;
    cursor.update(dog);
    cursor.continue();
  };
}

/** Converts old per-dog session lists into play-log records (same start time = same session). */
export function legacySessions(dogs) {
  const byStart = new Map();
  for (const dog of dogs) {
    for (const s of Array.isArray(dog.sessions) ? dog.sessions : []) {
      const startedAt = Number(s.startedAt);
      const duration = Number(s.duration);
      if (!startedAt || !duration) continue;
      const entry = byStart.get(startedAt) ?? {
        id: `legacy-${startedAt}`,
        startedAt,
        endedAt: startedAt + duration * 1000,
        duration,
        planned: duration,
        completed: true,
        dogIds: [],
        dogNames: [],
      };
      entry.dogIds.push(dog.id);
      entry.dogNames.push(dog.name);
      byStart.set(startedAt, entry);
    }
  }
  return [...byStart.values()];
}

async function transact(storeNames, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    const result = work(stores);
    tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadDogs() {
  const dogs = await transact(['dogs'], 'readonly', ({ dogs }) => dogs.getAll());
  return dogs.sort((a, b) => a.name.localeCompare(b.name));
}

export const saveDog = (dog) => transact(['dogs'], 'readwrite', ({ dogs }) => dogs.put(dog));
export const deleteDog = (id) => transact(['dogs'], 'readwrite', ({ dogs }) => dogs.delete(id));

export async function loadSessions() {
  const sessions = await transact(['sessions'], 'readonly', ({ sessions }) => sessions.getAll());
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export const saveSession = (session) =>
  transact(['sessions'], 'readwrite', ({ sessions }) => sessions.put(session));

export const deleteSession = (id) =>
  transact(['sessions'], 'readwrite', ({ sessions }) => sessions.delete(id));

export const loadWeights = () => transact(['weights'], 'readonly', ({ weights }) => weights.getAll());

/** One entry per dog per day: { id: `${dogId}:${date}`, dogId, date: 'YYYY-MM-DD', weight?, food? } */
export const saveWeight = (entry) => transact(['weights'], 'readwrite', ({ weights }) => weights.put(entry));

export const deleteWeight = (id) => transact(['weights'], 'readwrite', ({ weights }) => weights.delete(id));

export async function loadRewards() {
  const rewards = await transact(['rewards'], 'readonly', ({ rewards }) => rewards.getAll());
  return rewards.sort((a, b) => b.at - a.at);
}

/** { id, type: 'walk' | 'trick' | 'redeem', at: ms, dogIds: [], dogNames: [], miles? | name? | prizeName?, cost? } */
export const saveReward = (reward) => transact(['rewards'], 'readwrite', ({ rewards }) => rewards.put(reward));

export const deleteReward = (id) => transact(['rewards'], 'readwrite', ({ rewards }) => rewards.delete(id));

export async function loadPrizes() {
  const prizes = await transact(['prizes'], 'readonly', ({ prizes }) => prizes.getAll());
  return prizes.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}

/** { id, name, cost } */
export const savePrize = (prize) => transact(['prizes'], 'readwrite', ({ prizes }) => prizes.put(prize));

export const deletePrize = (id) => transact(['prizes'], 'readwrite', ({ prizes }) => prizes.delete(id));

/**
 * Replaces everything at once (used when restoring a backup). `prizeList` is undefined for backups made before
 * the Prize Shop existed: then the current prizes are kept instead of being cleared.
 */
export function replaceEverything(dogList, sessionList, weightList = [], rewardList = [], prizeList) {
  return transact(['dogs', 'sessions', 'weights', 'rewards', 'prizes'], 'readwrite', ({ dogs, sessions, weights, rewards, prizes }) => {
    dogs.clear();
    sessions.clear();
    weights.clear();
    rewards.clear();
    for (const dog of dogList) dogs.put(dog);
    for (const session of sessionList) sessions.put(session);
    for (const entry of weightList) weights.put(entry);
    for (const reward of rewardList) rewards.put(reward);
    if (prizeList) {
      prizes.clear();
      for (const prize of prizeList) prizes.put(prize);
    }
  });
}
