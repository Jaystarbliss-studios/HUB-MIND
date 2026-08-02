const fs = require('fs');
let fbContent = fs.readFileSync('src/firebaseConfig.ts', 'utf8');
fbContent = fbContent.replace(/firebaseConfig\.firestoreDatabaseId/, "(firebaseConfig as any).firestoreDatabaseId");
fs.writeFileSync('src/firebaseConfig.ts', fbContent);
