const googleClientId =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID) ||
  (typeof process !== 'undefined' && process?.env?.VITE_GOOGLE_CLIENT_ID) ||
  "";

export let driveConfig = {
  clientId: googleClientId,
};

export async function initDriveConfig() {
  if (driveConfig.clientId) return driveConfig.clientId;

  try {
    const res = await fetch('/api/config');
    const data = await res.json();

    if (data.googleClientId) {
      driveConfig.clientId = data.googleClientId;
    }
  } catch (e) {
    console.error("Failed to load drive config", e);
  }

  return driveConfig.clientId;
}
