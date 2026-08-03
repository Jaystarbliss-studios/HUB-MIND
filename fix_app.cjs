const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Remove RedirectOnReload definition and usage
content = content.replace(/let hasAppLoaded = false;[\s\S]*?return null;\n\}/, '');
content = content.replace(/<RedirectOnReload \/>\s*/, '');

// Add history replaceState at the top, just after imports
const redirectScript = `
if (typeof window !== 'undefined') {
  if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
    window.history.replaceState(null, '', '/');
  }
}
`;

content = content.replace(/import \{ useEffect \} from 'react';/, redirectScript);

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed App.tsx');
