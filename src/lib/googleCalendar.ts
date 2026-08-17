import { driveConfig, initDriveConfig } from '../driveConfig';

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  startDateTime: string; // ISO string
  endDateTime?: string;   // ISO string
  reminderMinutes?: number;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

let cachedCalendarToken: string | null = null;
let tokenExpiryTime: number = 0;

export async function getCalendarAccessToken(): Promise<string> {
  if (cachedCalendarToken && Date.now() < tokenExpiryTime) {
    return cachedCalendarToken;
  }

  await initDriveConfig();
  const clientId = driveConfig.clientId;

  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured.');
  }

  return new Promise((resolve, reject) => {
    // Ensure GSI script is loaded
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
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            cachedCalendarToken = response.access_token;
            // Default 3500 seconds expiry
            tokenExpiryTime = Date.now() + (parseInt(response.expires_in, 10) || 3500) * 1000;
            resolve(response.access_token);
          },
        });
        tokenClient.requestAccessToken({ prompt: '' });
      } catch (err) {
        reject(err);
      }
    };

    checkGSI();
  });
}

/**
 * Creates a Google Calendar event with reminders.
 * Note: Communicates clearly to user that this creates a Google Calendar event with notification reminder.
 */
export async function createGoogleCalendarEvent(payload: CalendarEventPayload): Promise<{
  success: boolean;
  event?: GoogleCalendarEvent;
  htmlLink?: string;
  message: string;
}> {
  const token = await getCalendarAccessToken();

  const startDate = new Date(payload.startDateTime);
  let endDate = payload.endDateTime ? new Date(payload.endDateTime) : new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min default
  if (endDate <= startDate) {
    endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
  }

  const reminderMinutes = payload.reminderMinutes !== undefined ? payload.reminderMinutes : 15;

  const eventBody = {
    summary: payload.summary,
    description: payload.description || 'Created by Shawn via Hub-Mind',
    start: {
      dateTime: startDate.toISOString(),
    },
    end: {
      dateTime: endDate.toISOString(),
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: reminderMinutes },
        { method: 'email', minutes: reminderMinutes },
      ],
    },
  };

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
  return {
    success: true,
    event,
    htmlLink: event.htmlLink,
    message: `Created Calendar event "${event.summary}" for ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with a ${reminderMinutes}-minute reminder popup.`,
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
  url.searchParams.set('maxResults', '20');

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
