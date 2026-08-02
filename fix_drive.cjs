const fs = require('fs');
let content = fs.readFileSync('src/driveConfig.ts', 'utf8');
content = content.replace(/import\.meta\.env\.VITE_GOOGLE_CLIENT_ID/, "(import.meta as any).env.VITE_GOOGLE_CLIENT_ID");
fs.writeFileSync('src/driveConfig.ts', content);
