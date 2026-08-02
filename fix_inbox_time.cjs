const fs = require('fs');

let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

content = content.replace(/\{actionType === 'meeting' && \(/, "{(actionType === 'meeting' || actionType === 'task') && (");
fs.writeFileSync('src/pages/Inbox.tsx', content);
