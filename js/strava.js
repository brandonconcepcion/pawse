// Strava sync: pulls your recent walks from Strava so they can become sticks (see sticks.js).
//
// Strava's login needs a secret that can't live in a browser, so every call goes through a tiny Cloudflare Worker
// (tools/strava-worker/worker.js). The Worker URL and your Strava "Client ID" are typed in once, in the app, and kept
// only on this device (localStorage 'pawse.strava', together with the login tokens). Nothing here is in a backup.

const KEY = 'pawse.strava';
const SKIPPED_KEY = 'pawse.stravaSkipped'; // activities you chose not to import, so they aren't offered again
const SCOPE = 'activity:read_all'; // read_all so walks set to "Only Me" in Strava are found too
const WALK_TYPES = ['Walk', 'Hike', 'Run'];
const METERS_PER_MILE = 1609.344;
const FIRST_SYNC_DAYS = 30;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
};
const write = (patch) => localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));

export const stravaStatus = () => {
  const s = read();
  return { configured: Boolean(s.clientId && s.proxy), connected: Boolean(s.refreshToken), lastSync: s.lastSync ?? null, athlete: s.athlete ?? '' };
};

export const stravaSetup = () => ({ clientId: read().clientId ?? '', proxy: read().proxy ?? '' });

/** Saves the Client ID and Worker URL. Returns an error message, or '' when fine. */
export function saveStravaSetup(clientId, proxy) {
  const id = String(clientId).trim();
  const url = String(proxy).trim().replace(/\/+$/, '');
  if (!/^\d+$/.test(id)) return 'The Client ID is a number, like 123456.';
  if (!/^https:\/\/.+/.test(url) && !/^http:\/\/localhost(:\d+)?$/.test(url)) return 'The Worker URL should start with https://';
  write({ clientId: id, proxy: url });
  return '';
}

/** The Strava page that asks you to allow Pawse. It sends you back to this same page with ?code=… */
export function stravaLoginURL() {
  const { clientId } = read();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${location.origin}${location.pathname}`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state: 'pawse',
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

async function proxy(path, { method = 'GET', body, token } = {}) {
  const { proxy: base } = read();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Strava said ${response.status}`);
  return data;
}

const keepTokens = (data) => write({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at });

/** True when the page was opened by Strava sending you back after you tapped Allow (or Cancel). */
export const isStravaRedirect = () => new URLSearchParams(location.search).get('state') === 'pawse';

/** Finishes the login: trades the ?code for tokens and tidies the address bar. Throws if you said no. */
export async function finishStravaLogin() {
  const params = new URLSearchParams(location.search);
  history.replaceState(null, '', `${location.pathname}#/shop`);
  const code = params.get('code');
  if (params.get('error') || !code) throw new Error('Strava login was cancelled.');
  if (!(params.get('scope') ?? '').includes('activity:read')) throw new Error('Pawse needs permission to read your activities. Connect again and keep that box ticked.');
  const data = await proxy('/token', { method: 'POST', body: { code } });
  keepTokens(data);
  write({ athlete: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') });
}

async function accessToken() {
  const s = read();
  if (!s.refreshToken) throw new Error('Not connected to Strava.');
  if (s.accessToken && s.expiresAt * 1000 - Date.now() > 120000) return s.accessToken;
  const data = await proxy('/refresh', { method: 'POST', body: { refresh_token: s.refreshToken } });
  keepTokens(data);
  return data.access_token;
}

/**
 * Recent walks from Strava, newest first, as { id, name, at, miles }. Skips ones already imported
 * (`knownIds`) or turned down before, and anything under 0.1 mile.
 */
export async function fetchStravaWalks(knownIds) {
  const s = read();
  const since = s.lastSync ? s.lastSync - 24 * 3600 * 1000 : Date.now() - FIRST_SYNC_DAYS * 24 * 3600 * 1000;
  const token = await accessToken();
  const skipped = new Set(JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? '[]'));
  const walks = [];
  for (let page = 1; page <= 4; page += 1) {
    const activities = await proxy(`/activities?after=${Math.floor(since / 1000)}&per_page=50&page=${page}`, { token });
    if (!Array.isArray(activities)) break;
    for (const a of activities) {
      const id = String(a.id);
      const miles = Math.round((a.distance / METERS_PER_MILE) * 10) / 10;
      if (!WALK_TYPES.includes(a.sport_type ?? a.type) || miles < 0.1 || knownIds.has(id) || skipped.has(id)) continue;
      walks.push({ id, name: String(a.name ?? 'Walk'), at: Date.parse(a.start_date), miles });
    }
    if (activities.length < 50) break;
  }
  return walks.sort((a, b) => b.at - a.at);
}

/** Call after the review sheet is saved: remembers the ones turned down and moves the sync window forward. */
export function finishStravaSync(skippedIds) {
  const skipped = new Set(JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? '[]'));
  for (const id of skippedIds) skipped.add(id);
  localStorage.setItem(SKIPPED_KEY, JSON.stringify([...skipped]));
  write({ lastSync: Date.now() });
}

export async function disconnectStrava() {
  const s = read();
  try {
    if (s.accessToken) await proxy('/deauthorize', { method: 'POST', body: { access_token: s.accessToken } });
  } catch {
    // Disconnecting on this device still works if Strava can't be reached.
  }
  write({ accessToken: '', refreshToken: '', expiresAt: 0, lastSync: null, athlete: '' });
}

/** Dogs whose name appears in an activity title ("Morning walk with Teddy"). */
export const dogsInTitle = (title, dogs) =>
  dogs.filter((d) => new RegExp(`\\b${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title));
