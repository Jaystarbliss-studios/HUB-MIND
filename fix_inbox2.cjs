const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

// Remove from knowledge
content = content.replace(
  /createdBy: profile\?\.id,\s*clientId: clientId \|\| null,/,
  "createdBy: profile?.id,"
);

// Remove from clients
content = content.replace(
  /ownerId: profile\?\.id,\s*clientId: clientId \|\| null,/,
  "ownerId: profile?.id,"
);

// Add to tasks
content = content.replace(
  /createdBy: profile\?\.id,\s*checklist:/,
  "createdBy: profile?.id,\n          clientId: clientId || null,\n          checklist:"
);

// Add to meetings
content = content.replace(
  /ownerId: profile\?\.id,\s*createdAt:/,
  "ownerId: profile?.id,\n          clientId: clientId || null,\n          createdAt:"
);

fs.writeFileSync('src/pages/Inbox.tsx', content);
console.log('Inbox fixed 2');
