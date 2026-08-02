const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminUsers.tsx', 'utf8');
content = content.replace(/\{Object\.entries\(userLookup\)\.map\(\(\[id, u\]\) => \(/, "{Object.entries(userLookup).map(([id, u]: [string, any]) => (");
fs.writeFileSync('src/pages/AdminUsers.tsx', content);
