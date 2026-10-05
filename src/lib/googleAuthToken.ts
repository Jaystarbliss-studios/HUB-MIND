import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { driveConfig, initDriveConfig } from '../driveConfig';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
];

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

const STORAGE_CALENDAR_TOKEN = 'hubmind_gcal_token_v2';
const STORAGE_CALENDAR_EXP = 'hubmind_gcal_token_exp_v2';
function userStorageKey(base: string) { return `${base}_${auth.currentUser?.uid || 'anonymous'}`; }
const STORAGE_DRIVE_TOKEN = 'hubmind_gdrive_token';

let cachedCalendarToken: string | null = null;
let calendarTokenExpiry = 0;

export function setCachedCalendarToken(token: string, expiresInSeconds = 3500) {
  cachedCalendarToken = token;
  calendarTokenExpiry = Date.now() + expiresInSeconds * 1000;
  try {
    localStorage.setItem(userStorageKey(STORAGE_CALENDAR_TOKEN), token);
    localStorage.setItem(userStorageKey(STORAGE_CALENDAR_EXP), String(calendarTokenExpiry));
  } catch {}
}

export function getCachedCalendarToken(): string | null {
  if (!auth.currentUser) return null;
  if (cachedCalendarToken && Date.now() < calendarTokenExpiry - 60000) return cachedCalendarToken;
  try {
    const savedToken = localStorage.getItem(userStorageKey(STORAGE_CALENDAR_TOKEN));
    const savedExp = Number(localStorage.getItem(userStorageKey(STORAGE_CALENDAR_EXP))) || 0;
    if (savedToken && Date.now() < savedExp - 60000) {
      cachedCalendarToken = savedToken;
      calendarTokenExpiry = savedExp;
      return savedToken;
    }
  } catch {}
  return null;
}

export function clearGoogleTokens() {
  cachedCalendarToken = null;
  calendarTokenExpiry = 0;
  try {
    localStorage.removeItem(userStorageKey(STORAGE_CALENDAR_TOKEN));
    localStorage.removeItem(userStorageKey(STORAGE_CALENDAR_EXP));
    localStorage.removeItem(userStorageKey(STORAGE_DRIVE_TOKEN));
    localStorage.removeItem(userStorageKey('hubmind_gcal_connected'));
    localStorage.removeItem(userStorageKey('hubmind_gcal_email'));
    // Remove the old unscoped keys from previous builds.
    localStorage.removeItem('hubmind_gcal_token');
    localStorage.removeItem('hubmind_gcal_token_exp');
    localStorage.removeItem('hubmind_gcal_connected');
    localStorage.removeItem('hubmind_gcal_email');
  } catch {}
}

/**
 * Requests a Google OAuth access token using Firebase Auth popup (with GSI fallback).
 * MUST be invoked in response to a user action (click/touch) to avoid popup blocker issues.
 */
export async function requestGoogleAccessToken(scopes: string[] = CALENDAR_SCOPES, interactive = true): Promise<string> {
  // If the user already granted this scope, ask Google for a fresh access token
  // silently first. This makes the connection durable across token expiry, reloads,
  // and later Jess sessions without repeatedly asking the user to reconnect.
  if (!interactive) {
    try {
      await initDriveConfig();
      const clientId = driveConfig.clientId;
      const g = (window as any).google;
      if (clientId && g?.accounts?.oauth2) {
        const token = await new Promise<string | null>((resolve) => {
          let settled = false;
          const timer = window.setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 2500);
          try {
            const client = g.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: scopes.join(' '),
              callback: (resp: any) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                resolve(resp?.access_token || null);
              },
            });
            client.requestAccessToken({ prompt: '' });
          } catch {
            window.clearTimeout(timer);
            resolve(null);
          }
        });
        if (token) {
          setCachedCalendarToken(token);
          return token;
        }
      }
    } catch {}
  }

  // 1. Try Firebase Auth popup (works reliably inside AI Studio preview iframe)
  try {
    if (!interactive) throw new Error('Silent Google Calendar renewal unavailable; interactive authorization is required.');
    const provider = new GoogleAuthProvider();
    scopes.forEach(scope => provider.addScope(scope));
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedCalendarToken(credential.accessToken);
      return credential.accessToken;
    }
  } catch (firebaseErr: any) {
    console.warn('[googleAuthToken] Firebase signInWithPopup warning:', firebaseErr);
  }

  // 2. Fallback to GSI if available
  await initDriveConfig();
  const clientId = driveConfig.clientId;
  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured.');
  }

  return new Promise((resolve, reject) => {
    const g = (window as any).google;
    if (!g || !g.accounts || !g.accounts.oauth2) {
      // Lazy load GSI script if not present
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: scopes.join(' '),
            callback: (resp: any) => {
              if (resp.error) {
                reject(new Error(resp.error_description || resp.error));
                return;
              }
              if (resp.access_token) {
                setCachedCalendarToken(resp.access_token, parseInt(resp.expires_in, 10) || 3500);
                resolve(resp.access_token);
              } else {
                reject(new Error('No access token received from Google'));
              }
            },
          });
          client.requestAccessToken({ prompt: '' });
        } catch (err) {
          reject(err);
        }
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.body.appendChild(script);
      return;
    }

    try {
      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (resp.access_token) {
            setCachedCalendarToken(resp.access_token, parseInt(resp.expires_in, 10) || 3500);
            resolve(resp.access_token);
          } else {
            reject(new Error('No access token received from Google'));
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}
