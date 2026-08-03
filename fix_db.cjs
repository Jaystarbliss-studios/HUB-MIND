const fs = require('fs');

// Fix firebase-applet-config.json
let config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
delete config.firestoreDatabaseId;
fs.writeFileSync('firebase-applet-config.json', JSON.stringify(config, null, 2));

// Fix src/firebaseConfig.ts
let tsContent = fs.readFileSync('src/firebaseConfig.ts', 'utf8');
tsContent = tsContent.replace(/export const db = getFirestore\(app, [^\)]+\);/, 'export const db = getFirestore(app);');
fs.writeFileSync('src/firebaseConfig.ts', tsContent);

// Fix firebase.json
let fbJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
delete fbJson.firestore.database;
fs.writeFileSync('firebase.json', JSON.stringify(fbJson, null, 2));

console.log('Fixed');
