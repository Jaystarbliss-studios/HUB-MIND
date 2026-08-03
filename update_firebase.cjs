const fs = require('fs');
let fbContent = fs.readFileSync('src/firebaseConfig.ts', 'utf8');
fbContent = fbContent.replace(/export const db = getFirestore\(app\);/,
   "export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430');");
fs.writeFileSync('src/firebaseConfig.ts', fbContent);
