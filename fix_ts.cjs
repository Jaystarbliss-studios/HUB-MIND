const fs = require('fs');

let driveContent = fs.readFileSync('src/driveConfig.ts', 'utf8');
driveContent = driveContent.replace(/import\.meta\.env\.VITE_GOOGLE_CLIENT_ID/, "(import.meta as any).env.VITE_GOOGLE_CLIENT_ID");
fs.writeFileSync('src/driveConfig.ts', driveContent);

let fbContent = fs.readFileSync('src/firebaseConfig.ts', 'utf8');
fbContent = fbContent.replace(/firebaseConfigData\.firestoreDatabaseId/, "(firebaseConfigData as any).firestoreDatabaseId");
fs.writeFileSync('src/firebaseConfig.ts', fbContent);
