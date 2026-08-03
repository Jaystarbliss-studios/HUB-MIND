const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

// Just remove all clientIds that are followed by createdAt
content = content.replace(/clientId: clientId \|\| null,\s*createdAt:/g, "createdAt:");

// Now put it back ONLY for meetings, we can search for the exact block.
content = content.replace(
  /ownerId: profile\?\.id,\s*createdAt:/g,
  "ownerId: profile?.id,\n          clientId: clientId || null,\n          createdAt:"
);

// This added it to clients and meetings.
// Now remove it from clients specifically:
content = content.replace(
  /type: 'lead',\s*status: 'active',\s*ownerId: profile\?\.id,\s*clientId: clientId \|\| null,/g,
  "type: 'lead',\n        status: 'active',\n        ownerId: profile?.id,"
);

fs.writeFileSync('src/pages/Inbox.tsx', content);
console.log('Inbox fixed 4');
