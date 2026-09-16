import firebaseConfig from '../../firebase-applet-config.json';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

async function verifyFirebaseUser(idToken: string) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || (firebaseConfig as any).apiKey;
  if (!apiKey) throw new Error('Firebase Web API key is not configured.');

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) throw new Error('Your Hub-Mind session is no longer valid. Please sign in again.');
  const data = await response.json() as any;
  const user = data?.users?.[0];
  if (!user || user.disabled) throw new Error('Your Hub-Mind account is unavailable.');
  return user;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) return json({ error: 'Authentication required.' }, 401);

    const user = await verifyFirebaseUser(idToken);
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY is not configured on the deployment.' }, 503);

    const now = Date.now();
    const tokenResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: 'gemini-3.8-live',
          config: {
            responseModalities: ['AUDIO'],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
          },
        },
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || !tokenData?.name) {
      console.error('Gemini ephemeral-token provisioning failed:', tokenData);
      return json({ error: tokenData?.error?.message || 'Gemini Live token provisioning failed.' }, 502);
    }

    return json({ token: tokenData.name, userId: user.localId, expiresAt: tokenData.expireTime || null });
  } catch (error: any) {
    console.error('Shawn live-token function error:', error);
    return json({ error: error?.message || 'Could not initialise Shawn Live.' }, 500);
  }
};
