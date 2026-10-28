// Weight & food math for the gym: weekly averages, trend, and how food relates to weight change.
// Entries look like { date: 'YYYY-MM-DD', weight?: lb, food?: grams }.

const DAY = 24 * 60 * 60 * 1000;

const mean = (list) => (list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null);

export const toDate = (iso) => new Date(`${iso}T12:00:00`);

export function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing this date, as 'YYYY-MM-DD'. */
export function weekOf(iso) {
  const d = toDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}

/**
 * Groups entries into Monday-start weeks (oldest first). For each week:
 *   avgWeight – average of the weights logged that week
 *   avgFood   – average grams per logged day that week
 *   change    – avgWeight minus the previous week's avgWeight (only if that week was logged too)
 */
export function weeklySummary(entries) {
  const byWeek = new Map();
  for (const e of entries) {
    const key = weekOf(e.date);
    if (!byWeek.has(key)) byWeek.set(key, { week: key, weights: [], foods: [] });
    if (Number.isFinite(e.weight)) byWeek.get(key).weights.push(e.weight);
    if (Number.isFinite(e.food)) byWeek.get(key).foods.push(e.food);
  }
  const weeks = [...byWeek.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({
      week: w.week,
      avgWeight: mean(w.weights),
      avgFood: mean(w.foods),
      weighIns: w.weights.length,
      foodDays: w.foods.length,
      change: null,
    }));
  weeks.forEach((w, i) => {
    const prev = weeks[i - 1];
    const consecutive = prev && toDate(w.week) - toDate(prev.week) < 8 * DAY;
    if (consecutive && w.avgWeight !== null && prev.avgWeight !== null) w.change = w.avgWeight - prev.avgWeight;
  });
  return weeks;
}

function pearson(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  if (!sxx || !syy) return null;
  return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, intercept: my - (sxy / sxx) * mx };
}

/**
 * How weekly food relates to weekly weight change. Needs 3+ weeks that have both.
 * Returns { ready, weeksNeeded } or { ready, n, r, slopePer10g, steadyFood, verdict }.
 */
export function foodVsWeight(weeks) {
  const pairs = weeks.filter((w) => w.avgFood !== null && w.change !== null);
  if (pairs.length < 3) return { ready: false, weeksNeeded: 3 - pairs.length, n: pairs.length };
  const fit = pearson(pairs.map((w) => w.avgFood), pairs.map((w) => w.change));
  if (!fit) return { ready: false, weeksNeeded: 1, n: pairs.length, flat: true };
  const { r, slope, intercept } = fit;
  // Food level where the fitted line crosses "no change" — only meaningful if more food → more gain.
  const steady = slope > 0 ? -intercept / slope : null;
  let verdict;
  if (r >= 0.5) verdict = 'strong';
  else if (r >= 0.2) verdict = 'some';
  else if (r > -0.2) verdict = 'none';
  else verdict = 'opposite';
  return {
    ready: true,
    n: pairs.length,
    r,
    slopePer10g: slope * 10,
    steadyFood: steady !== null && steady > 0 && steady < 3000 ? steady : null,
    verdict,
  };
}

/** Average weekly change over the last few logged weeks, plus that as % of body weight. */
export function recentPace(weeks, lookback = 3) {
  const changes = weeks.filter((w) => w.change !== null).slice(-lookback);
  if (!changes.length) return null;
  const perWeek = mean(changes.map((w) => w.change));
  const latest = [...weeks].reverse().find((w) => w.avgWeight !== null)?.avgWeight;
  return { perWeek, percent: latest ? (perWeek / latest) * 100 : null, weeks: changes.length };
}

/** 0 = at start weight, 1 = reached goal. null if there's no goal or start yet. */
export function goalProgress(start, current, goal) {
  if (![start, current, goal].every(Number.isFinite) || start <= goal) return null;
  return Math.min(1, Math.max(0, (start - current) / (start - goal)));
}
