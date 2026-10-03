const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  '';

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'gen-lang-client-0197530608';

const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  process.env.VITE_FIRESTORE_DATABASE_ID ||
  'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430';

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
  const identityResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

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
          bidiGenerateContentSetup: {
            model: 'models/gemini-3.8-live',
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
            sessionResumption: {},
          },
        }),
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
