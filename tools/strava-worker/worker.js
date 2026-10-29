// Pawse ↔ Strava helper: a tiny Cloudflare Worker (free plan). It exists only because Strava's login needs a
// secret that must never sit in a browser app. It stores NOTHING: it forwards three kinds of request to Strava.
//
//   POST /token       { code }           → trade the login code for tokens
//   POST /refresh     { refresh_token }  → get a fresh access token (they last 6 hours)
//   POST /deauthorize { access_token }   → disconnect Pawse from the Strava account
//   GET  /activities?after=…&page=…      → the athlete's activities (needs the athlete's own "Authorization: Bearer" token)
//
// Settings (Cloudflare dashboard → the Worker → Settings → Variables and Secrets):
//   STRAVA_CLIENT_ID      (text)    from https://www.strava.com/settings/api
//   STRAVA_CLIENT_SECRET  (secret)  same page. Never put this in the Pawse repo.
//   ALLOWED_ORIGINS       (text)    sites allowed to call this, comma separated, e.g. https://brandonconcepcion.com
//                                   (http://localhost:… is always allowed so you can test)

const STRAVA = 'https://www.strava.com';

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return ok
    ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    }
    : null;
}

const json = (body, status, cors) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function tokenCall(env, params) {
  const response = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params }),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return new Response('Origin not allowed', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) return json({ error: 'Worker is not set up yet' }, 500, cors);

    const url = new URL(request.url);

    if (url.pathname === '/token' && request.method === 'POST') {
      const { code } = await readBody(request);
      if (!code) return json({ error: 'code is required' }, 400, cors);
      const { status, data } = await tokenCall(env, { code, grant_type: 'authorization_code' });
      return json(data, status, cors);
    }

    if (url.pathname === '/refresh' && request.method === 'POST') {
      const { refresh_token: refreshToken } = await readBody(request);
      if (!refreshToken) return json({ error: 'refresh_token is required' }, 400, cors);
      const { status, data } = await tokenCall(env, { refresh_token: refreshToken, grant_type: 'refresh_token' });
      return json(data, status, cors);
    }

    if (url.pathname === '/deauthorize' && request.method === 'POST') {
      const { access_token: accessToken } = await readBody(request);
      if (!accessToken) return json({ error: 'access_token is required' }, 400, cors);
      const response = await fetch(`${STRAVA}/oauth/deauthorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: accessToken }),
      });
      return json({ ok: response.ok }, response.status, cors);
    }

    if (url.pathname === '/activities' && request.method === 'GET') {
      const authorization = request.headers.get('Authorization');
      if (!authorization) return json({ error: 'missing token' }, 401, cors);
      const query = new URLSearchParams();
      for (const key of ['after', 'before', 'page', 'per_page']) {
        const value = url.searchParams.get(key);
        if (value && /^\d+$/.test(value)) query.set(key, value);
      }
      const response = await fetch(`${STRAVA}/api/v3/athlete/activities?${query}`, { headers: { Authorization: authorization } });
      return json(await response.json().catch(() => ({})), response.status, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },
};
