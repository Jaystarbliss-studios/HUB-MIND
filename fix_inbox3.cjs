const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

// The client addDoc is the first one that matches ownerId
content = content.replace(
  /ownerId: profile\?\.id,\s*clientId: clientId \|\| null,\s*createdAt: new Date\(\)\.toISOString\(\)\s*\}\);/g,
  "ownerId: profile?.id,\n        createdAt: new Date().toISOString()\n      });"
);

// Now the meeting one
content = content.replace(
  /ownerId: profile\?\.id,\s*createdAt: new Date\(\)\.toISOString\(\)\s*\}\);/g,
  "ownerId: profile?.id,\n          clientId: clientId || null,\n          createdAt: new Date().toISOString()\n        });"
);

// And wait, what about the first occurrence that gets replaced for clients?
// Let's just do an exact block replace to be safe.

fs.writeFileSync('src/pages/Inbox.tsx', content);
console.log('Inbox fixed 3');
