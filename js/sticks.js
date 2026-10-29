// Sticks: the reward currency. Dogs earn them for play, walks and new tricks, and spend them on prizes.
// Earned sticks are always worked out from the logs (play sessions + walks + tricks), never stored, so fixing or
// deleting a log entry fixes the total too. Only what was spent is stored (as 'redeem' records).

export const RATES = { perMinute: 1, perTenthMile: 3, perTrick: 50 };

// Prizes everyone starts with (the owner can edit them in the Prize Shop). Not personal data.
export const DEFAULT_PRIZES = [
  { id: 'default-treat', name: 'Special treat', cost: 100 },
  { id: 'default-toy', name: 'New toy', cost: 400 },
  { id: 'default-spa', name: 'Spa day', cost: 800 },
];

/** 1 stick for every full minute actually played (every pup in the session gets the full amount). */
export const playSticks = (session) => Math.floor(session.duration / 60) * RATES.perMinute;

/** 3 sticks per 0.1 mile, each pup on the walk. */
export const walkSticks = (walk) => Math.round(walk.miles * 10) * RATES.perTenthMile;

/**
 * Where one dog's sticks came from. `rewards` holds three kinds of record, all with a `dogIds` list:
 *   { type: 'walk', miles }  { type: 'trick', name }  { type: 'redeem', prizeName, cost }
 */
export function stickTotals(dogId, sessions, rewards) {
  const mine = rewards.filter((r) => r.dogIds.includes(dogId));
  const play = sessions.filter((s) => s.dogIds.includes(dogId)).reduce((sum, s) => sum + playSticks(s), 0);
  const walks = mine.filter((r) => r.type === 'walk').reduce((sum, r) => sum + walkSticks(r), 0);
  const tricks = mine.filter((r) => r.type === 'trick').length * RATES.perTrick;
  const spent = mine.filter((r) => r.type === 'redeem').reduce((sum, r) => sum + r.cost, 0);
  const earned = play + walks + tricks;
  return { play, walks, tricks, earned, spent, balance: earned - spent };
}
