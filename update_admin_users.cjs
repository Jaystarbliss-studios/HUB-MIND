const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminUsers.tsx', 'utf8');

// Import processRecurringTasks
content = content.replace(/import \{ db \} from '\.\.\/firebaseConfig';/, 
  "import { db } from '../firebaseConfig';\nimport { processRecurringTasks } from '../lib/recurringTasks';");

// Add button state
content = content.replace(/const \[showCreateUser, setShowCreateUser\] = useState\(false\);/,
  "const [showCreateUser, setShowCreateUser] = useState(false);\n  const [syncing, setSyncing] = useState(false);\n\n  const handleRunSync = async () => {\n    setSyncing(true);\n    await processRecurringTasks();\n    alert('Daily sync completed.');\n    setSyncing(false);\n  };\n");

// Add button to header
content = content.replace(/<button onClick=\{.*\} className="bg-accent text-slate-950 px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition-colors flex items-center gap-2">/,
  "<button onClick={handleRunSync} disabled={syncing} className=\"bg-slate-800 text-slate-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 transition-colors flex items-center gap-2\">\n          {syncing ? 'Syncing...' : 'Run Daily Sync'}\n        </button>\n        <button onClick={() => setShowCreateUser(true)} className=\"bg-accent text-slate-950 px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition-colors flex items-center gap-2\">");

fs.writeFileSync('src/pages/AdminUsers.tsx', content);
