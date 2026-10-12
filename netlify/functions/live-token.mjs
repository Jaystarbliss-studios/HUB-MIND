const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const liveTokenRateLimits = new Map();

function isRateLimited(req) {
  const now = Date.now();
  const clientKey = String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0, 160);
  const current = liveTokenRateLimits.get(clientKey);
  if (current && current.resetAt > now && current.count >= 20) return true;
  if (!current || current.resetAt <= now) liveTokenRateLimits.set(clientKey, { count: 1, resetAt: now + 60_000 });
  else current.count += 1;
  if (liveTokenRateLimits.size > 5000) for (const [key, value] of liveTokenRateLimits) if (value.resetAt <= now) liveTokenRateLimits.delete(key);
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function verifyFirebaseUser(idToken) {
  const identityPromise = fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const identityResponse = await identityPromise;

  if (!identityResponse.ok) {
    throw new Error('Your Hub-Mind session is no longer valid. Please sign in again.');
  }

  const identityData = await identityResponse.json();
  const user = identityData?.users?.[0];

  if (!user || user.disabled) {
    throw new Error('Your Hub-Mind account is unavailable.');
  }

  let role = 'staff';
  try {
    // The profile check remains non-fatal, but it is deliberately kept after
    // Firebase identity validation so invalid sessions never trigger a profile
    // lookup. This is the only additional request required for suspension checks.
    const profileResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/users/${encodeURIComponent(user.localId)}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
      },
    );

    if (profileResponse.ok) {
      const profileDocument = await profileResponse.json();
      const fields = profileDocument?.fields || {};
      const status = fields.status?.stringValue;
      role = fields.role?.stringValue || 'staff';

      if (status === 'suspended' || status === 'inactive') {
        throw new Error('Your Hub-Mind account is currently suspended.');
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('suspended')) {
      throw err;
    }
    console.warn('Profile fetch non-fatal fallback in live-token:', err);
  }

  return { ...user, hubMindRole: role };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (isRateLimited(req)) return json({ error: 'Too many Jess session requests. Please wait a minute and try again.' }, 429);

  try {
    const authorization = req.headers.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!idToken) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const user = await verifyFirebaseUser(idToken);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return json(
        { error: 'GEMINI_API_KEY is not configured on the deployment.' },
        503,
      );
    }

    const tokenResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/auth_tokens',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
          liveConnectConstraints: {
            model: 'models/gemini-3.8-live',
          },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData?.name) {
      console.error('Gemini ephemeral-token provisioning failed:', tokenData);
      return json(
        {
          error:
            tokenData?.error?.message ||
            'Gemini Live token provisioning failed.',
        },
        502,
      );
    }

    return json({
      token: tokenData.name,
      userId: user.localId,
      expiresAt: tokenData.expireTime || null,
    });
  } catch (error) {
    console.error('Jess live-token function error:', error);
    return json(
      { error: error?.message || 'Could not initialise Jess Live.' },
      500,
    );
  }
}

export const config = { path: '/api/live-token' };
