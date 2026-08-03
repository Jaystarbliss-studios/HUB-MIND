const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace(
    /import \{ useAuth \} from '\.\.\/lib\/auth';/,
    "import { useAuth } from '../lib/auth';\nimport { useNavigate } from 'react-router-dom';"
  );
  
  content = content.replace(
    /const \{ profile \} = useAuth\(\);/,
    "const { profile } = useAuth();\n  const navigate = useNavigate();"
  );
  
  // Find where it resets state after a successful action (around setActiveItem(null))
  content = content.replace(
    /setActiveItem\(null\);\n\s*setActionType\(null\);/,
    `setActiveItem(null);
      setActionType(null);
      if (actionType === 'task' && docRefId) {
        navigate('/tasks/' + docRefId);
      }`
  );

  fs.writeFileSync('src/pages/Inbox.tsx', content);
  console.log('Inbox nav updated');
} else {
  console.log('Already updated');
}
