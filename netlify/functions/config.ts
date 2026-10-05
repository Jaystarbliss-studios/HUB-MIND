const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
});

export default async function handler(req) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const required = {
    apiKey: process.env.FIREBASE_WEB_API_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || '(default)',
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  };

  const missing = Object.entries(required)
    .filter(([key, value]) => key !== 'googleClientId' && !value)
    .map(([key]) => key);

  if (missing.length) {
    console.error('Public client configuration is incomplete:', missing);
    return json({ error: 'Client configuration is unavailable.' }, 503);
  }

  // These values are Firebase/Google browser configuration, not authorization
  // credentials. They are fetched at runtime so their values are never embedded
  // in the static build artifacts scanned by Netlify.
  return json({
    firebase: {
      apiKey: required.apiKey,
      projectId: required.projectId,
      appId: required.appId,
      messagingSenderId: required.messagingSenderId,
      authDomain: required.authDomain || `${required.projectId}.firebaseapp.com`,
      storageBucket: required.storageBucket || `${required.projectId}.firebasestorage.app`,
      firestoreDatabaseId: required.firestoreDatabaseId,
    },
    googleClientId: required.googleClientId,
  });
}

export const config = { path: '/api/config' };
