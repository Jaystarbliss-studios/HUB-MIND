/** Runtime API base for the Hub-Mind backend. */
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Optional explicit WebSocket endpoint for Jess Live. This is useful when
 * Netlify hosts the PWA while the long-lived Node WebSocket server runs on a
 * separate service. Falls back to the HTTP API base/current origin.
 */
export const JESS_LIVE_WS_URL = String(import.meta.env.VITE_JESS_LIVE_WS_URL || '').replace(/\/$/, '');
export const LIVE_WS_URL = JESS_LIVE_WS_URL;

export const apiUrl = (path: string) => {
  if (!API_BASE_URL) return path;
  return API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
};
