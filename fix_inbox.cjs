const fs = require('fs');
let code = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

code = code.replace(
  "import { useAuth } from '../lib/auth';",
  "import { useAuth } from '../lib/auth';\nimport { useLocation } from 'react-router-dom';"
);

code = code.replace(
  "const navigate = useNavigate();",
  "const navigate = useNavigate();\n  const location = useLocation();\n  const isShared = new URLSearchParams(location.search).get('shared') === 'true';"
);

code = code.replace(
  '<h1 className="text-3xl font-bold text-white tracking-tight">Inbox</h1>',
  '<h1 className="text-3xl font-bold text-white tracking-tight">Inbox</h1>\n          {isShared && <span className="bg-accent/20 text-accent text-xs px-2 py-1 rounded ml-3">File Shared Successfully</span>}'
);

fs.writeFileSync('src/pages/Inbox.tsx', code);
