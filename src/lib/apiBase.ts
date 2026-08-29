/** Runtime API base for the Hub-Mind backend. */
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const apiUrl = (path: string) => {
  if (!API_BASE_URL) return path;
  return API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
};
