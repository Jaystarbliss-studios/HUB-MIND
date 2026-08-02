import firebaseConfig from '../firebase-applet-config.json';
export const driveConfig = {
  clientId: (firebaseConfig as any).oAuthClientId || (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || "",
};
