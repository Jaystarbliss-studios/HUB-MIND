import { driveConfig, initDriveConfig } from '../driveConfig';

let tokenClient: any = null;
let cachedToken: string | null = null;

export const initGoogleApi = async () => {
  await initDriveConfig();
  return new Promise((resolve) => {
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      if (typeof (window as any).google !== 'undefined') {
        initClient();
        resolve(true);
      } else {
        setTimeout(() => {
          initClient();
          resolve(true);
        }, 1000);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initClient();
      resolve(true);
    };
    document.body.appendChild(script);
  });
};

const initClient = () => {
  if (tokenClient) return;
  if (typeof (window as any).google === 'undefined') return;
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: driveConfig.clientId,
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send',
    callback: (response: any) => {
      if (response.error !== undefined) {
        console.error('OAuth error:', response.error);
        return;
      }
      cachedToken = response.access_token;
    },
  });
};

export const getGoogleToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (cachedToken) {
      resolve(cachedToken);
      return;
    }
    if (!tokenClient) {
      reject(new Error("Google API not initialized"));
      return;
    }
    // Override callback for this specific request
    tokenClient.callback = (response: any) => {
      if (response.error !== undefined) {
        reject(new Error(response.error));
        return;
      }
      cachedToken = response.access_token;
      resolve(cachedToken);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

export const getCalendarEvents = async (timeMin: string, timeMax: string) => {
  const token = await getGoogleToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error("Failed to fetch calendar");
  return res.json();
};

export const sendEmail = async (to: string, subject: string, body: string) => {
  const token = await getGoogleToken();
  const rawMessage = `To: ${to}\r\nSubject: ${subject}\r\n\r\n${body}`;
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedMessage })
  });
  if (!res.ok) throw new Error("Failed to send email");
  return res.json();
};

export const createCalendarEvent = async (summary: string, description: string, start: string, end: string) => {
  const token = await getGoogleToken();
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end }
    })
  });
  if (!res.ok) throw new Error("Failed to create calendar event");
  return res.json();
};
