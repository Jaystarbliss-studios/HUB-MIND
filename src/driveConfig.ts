import firebaseConfig from '../firebase-applet-config.json';

export let driveConfig = {
  clientId: (firebaseConfig as any).oAuthClientId || (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || "",
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
