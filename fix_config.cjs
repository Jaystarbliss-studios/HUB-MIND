const fs = require('fs');
let config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
config.firestoreDatabaseId = "ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430";
fs.writeFileSync('firebase-applet-config.json', JSON.stringify(config, null, 2));
