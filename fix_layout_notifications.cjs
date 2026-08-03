const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

if (!content.includes('usePushNotifications')) {
  content = content.replace(
    /import \{ useAuth \} from '\.\.\/lib\/auth';/,
    "import { useAuth } from '../lib/auth';\nimport { usePushNotifications } from '../lib/usePushNotifications';"
  );
  
  content = content.replace(
    /const recurringChecked = useRef\(false\);/,
    "const recurringChecked = useRef(false);\n  const { permission, requestPermission } = usePushNotifications(profile?.id);"
  );
  
  // Add a button in header if permission === 'default'
  const notifButton = `
            {permission === 'default' && (
              <button 
                onClick={requestPermission}
                className="text-xs font-bold text-accent border border-accent/30 bg-accent/10 px-2 py-1 rounded hover:bg-accent/20 transition-colors hidden sm:block"
              >
                Enable Push
              </button>
            )}
            <NavLink to="/notifications" className="relative cursor-pointer group">`;
            
  content = content.replace(
    /<NavLink to="\/notifications" className="relative cursor-pointer group">/,
    notifButton
  );

  const mobileNotifButton = `
            {permission === 'default' && (
              <button 
                onClick={requestPermission}
                className="text-[10px] font-bold text-accent border border-accent/30 bg-accent/10 px-2 py-1 rounded hover:bg-accent/20 transition-colors"
              >
                Enable Push
              </button>
            )}
            <NavLink to="/notifications" className="relative group">`;
            
  content = content.replace(
    /<NavLink to="\/notifications" className="relative group">/,
    mobileNotifButton
  );
  
  fs.writeFileSync('src/components/Layout.tsx', content);
  console.log('Layout updated with push notifications');
} else {
  console.log('Already updated');
}
