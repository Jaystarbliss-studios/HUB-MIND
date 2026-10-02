import { driveConfig, initDriveConfig } from '../driveConfig';
import { db, auth } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  startDateTime: string; // ISO string or YYYY-MM-DDTHH:mm:ss
  endDateTime?: string;   // ISO string or YYYY-MM-DDTHH:mm:ss
  reminderMinutes?: number;
  location?: string;
  recurrenceRule?: string; // e.g. 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR' or 'RRULE:FREQ=DAILY'
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  recurrence?: string[];
}

const STORAGE_TOKEN_KEY = 'hubmind_gcal_token';
const STORAGE_EXP_KEY = 'hubmind_gcal_token_exp';
const STORAGE_CONNECTED_KEY = 'hubmind_gcal_connected';
const STORAGE_EMAIL_KEY = 'hubmind_gcal_email';

let cachedCalendarToken: string | null = null;
let tokenExpiryTime: number = 0;

// Initialize memory cache from localStorage if valid
try {
  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const savedExp = Number(localStorage.getItem(STORAGE_EXP_KEY)) || 0;
  if (savedToken && Date.now() < savedExp) {
    cachedCalendarToken = savedToken;
    tokenExpiryTime = savedExp;
  }
} catch {}

export function isGoogleCalendarConnected(): boolean {
  try {
    const isConn = localStorage.getItem(STORAGE_CONNECTED_KEY) === 'true';
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const savedExp = Number(localStorage.getItem(STORAGE_EXP_KEY)) || 0;
    return isConn && !!savedToken && Date.now() < savedExp;
  } catch {
    return !!cachedCalendarToken && Date.now() < tokenExpiryTime;
  }
}

export function getGoogleCalendarConnectionInfo(): {
  connected: boolean;
  email: string | null;
  expiresAt: number;
} {
  try {
    const isConn = localStorage.getItem(STORAGE_CONNECTED_KEY) === 'true';
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const savedExp = Number(localStorage.getItem(STORAGE_EXP_KEY)) || 0;
    const email = localStorage.getItem(STORAGE_EMAIL_KEY) || auth.currentUser?.email || null;
    const isValid = isConn && !!savedToken && Date.now() < savedExp;
    return { connected: isValid, email: isValid ? email : null, expiresAt: savedExp };
  } catch {
    return { connected: false, email: null, expiresAt: 0 };
  }
}

export async function disconnectGoogleCalendar(): Promise<void> {
  cachedCalendarToken = null;
  tokenExpiryTime = 0;
  try {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_EXP_KEY);
    localStorage.removeItem(STORAGE_CONNECTED_KEY);
    localStorage.removeItem(STORAGE_EMAIL_KEY);
  } catch {}

  const current = auth.currentUser;
  if (current) {
    try {
      await updateDoc(doc(db, 'users', current.uid), {
        googleCalendarConnected: false,
        googleCalendarDisconnectedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not update user doc on gcal disconnect:', e);
    }
  }
}

export async function getCalendarAccessToken(forceRefresh = false): Promise<string> {
  // Check memory or localStorage if valid and not forcing refresh
  if (!forceRefresh && cachedCalendarToken && Date.now() < tokenExpiryTime - 60000) {
    return cachedCalendarToken;
  }

  try {
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const savedExp = Number(localStorage.getItem(STORAGE_EXP_KEY)) || 0;
    if (!forceRefresh && savedToken && Date.now() < savedExp - 60000) {
      cachedCalendarToken = savedToken;
      tokenExpiryTime = savedExp;
      return savedToken;
    }
  } catch {}

  await initDriveConfig();
  const clientId = driveConfig.clientId;

  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured. Please ensure your Google Cloud Client ID is set.');
  }

  return new Promise((resolve, reject) => {
    const checkGSI = () => {
      const g = (window as any).google;
      if (!g || !g.accounts || !g.accounts.oauth2) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => initClient();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.body.appendChild(script);
      } else {
        initClient();
      }
    };

    const initClient = () => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
          callback: async (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            const token = response.access_token;
            const expiresIn = parseInt(response.expires_in, 10) || 3500;
            const expiry = Date.now() + expiresIn * 1000;

            cachedCalendarToken = token;
            tokenExpiryTime = expiry;

            try {
              localStorage.setItem(STORAGE_TOKEN_KEY, token);
              localStorage.setItem(STORAGE_EXP_KEY, String(expiry));
              localStorage.setItem(STORAGE_CONNECTED_KEY, 'true');
              if (auth.currentUser?.email) {
                localStorage.setItem(STORAGE_EMAIL_KEY, auth.currentUser.email);
              }
            } catch {}

            const user = auth.currentUser;
            if (user) {
              try {
                await updateDoc(doc(db, 'users', user.uid), {
                  googleCalendarConnected: true,
                  googleCalendarConnectedAt: new Date().toISOString(),
                });
              } catch (e) {
                console.warn('Could not sync gcal connection to user doc:', e);
              }
            }

            resolve(token);
          },
        });
        tokenClient.requestAccessToken({ prompt: forceRefresh ? 'consent' : '' });
      } catch (err) {
        reject(err);
      }
    };

    checkGSI();
  });
}

/**
 * One-time connection helper for Google Calendar.
 * Prompts user once to grant permission and persists the token and connection state.
 */
export async function connectGoogleCalendarOnce(): Promise<{
  success: boolean;
  message: string;
  email?: string;
}> {
  try {
    const token = await getCalendarAccessToken(true);
    // Verify token by making a test calendar request
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    let primaryEmail = auth.currentUser?.email || 'your Google account';
    if (res.ok) {
      const calData = await res.json().catch(() => ({}));
      if (calData.id) {
        primaryEmail = calData.id;
        try {
          localStorage.setItem(STORAGE_EMAIL_KEY, primaryEmail);
        } catch {}
      }
    }

    return {
      success: true,
      email: primaryEmail,
      message: `Google Calendar successfully connected for ${primaryEmail}. Hub-Mind will sync events and recurring schedules seamlessly without prompting every time.`,
    };
  } catch (error: any) {
    console.error('Google Calendar one-time connection failed:', error);
    return {
      success: false,
      message: error?.message || 'Failed to connect Google Calendar. Please check your browser popup blocker or permissions.',
    };
  }
}

/**
 * Creates a Google Calendar event (supports single and recurring events with reminders).
 */
export async function createGoogleCalendarEvent(payload: CalendarEventPayload): Promise<{
  success: boolean;
  event?: GoogleCalendarEvent;
  htmlLink?: string;
  message: string;
}> {
  const token = await getCalendarAccessToken();

  const startDate = new Date(payload.startDateTime);
  let endDate = payload.endDateTime ? new Date(payload.endDateTime) : new Date(startDate.getTime() + 45 * 60 * 1000);
  if (endDate <= startDate) {
    endDate = new Date(startDate.getTime() + 45 * 60 * 1000);
  }

  const reminderMinutes = payload.reminderMinutes !== undefined ? payload.reminderMinutes : 15;

  const eventBody: any = {
    summary: payload.summary,
    description: payload.description || 'Created by Jess via Hub-Mind',
    start: {
      dateTime: startDate.toISOString(),
    },
    end: {
      dateTime: endDate.toISOString(),
    },
    location: payload.location || undefined,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: reminderMinutes },
        { method: 'email', minutes: reminderMinutes },
      ],
    },
  };

  // Support recurring Google Calendar events via RRULE
  if (payload.recurrenceRule) {
    const cleanRule = payload.recurrenceRule.startsWith('RRULE:')
      ? payload.recurrenceRule
      : `RRULE:${payload.recurrenceRule}`;
    eventBody.recurrence = [cleanRule];
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Calendar API error: ${res.statusText}`);
  }

  const event: GoogleCalendarEvent = await res.json();
  const recurringText = payload.recurrenceRule ? ' (Recurring schedule)' : '';
  return {
    success: true,
    event,
    htmlLink: event.htmlLink,
    message: `Created Calendar event "${event.summary}"${recurringText} starting ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with a ${reminderMinutes}-minute reminder popup.`,
  };
}

export async function listGoogleCalendarEvents(timeMin?: string, timeMax?: string): Promise<GoogleCalendarEvent[]> {
  const token = await getCalendarAccessToken();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin || new Date().toISOString());
  if (timeMax) {
    url.searchParams.set('timeMax', timeMax);
  }
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '30');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to fetch events: ${res.statusText}`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const token = await getCalendarAccessToken();

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Failed to delete calendar event: ${res.statusText}`);
  }

  return true;
}
