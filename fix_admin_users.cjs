const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminUsers.tsx', 'utf8');
content = content.replace(/import \{ db, auth \} from '\.\.\/firebaseConfig';/,
  "import { db, auth } from '../firebaseConfig';\nimport { processRecurringTasks } from '../lib/recurringTasks';");

fs.writeFileSync('src/pages/AdminUsers.tsx', content);
