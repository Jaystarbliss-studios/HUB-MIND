const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const redirectCode = `
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

let hasAppLoaded = false;

function RedirectOnReload() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!hasAppLoaded) {
      hasAppLoaded = true;
      if (location.pathname !== '/' && location.pathname !== '/login') {
        navigate('/');
      }
    }
  }, [location, navigate]);

  return null;
}
`;

if (!content.includes('RedirectOnReload')) {
  // insert before function ProtectedRoute
  content = content.replace('function ProtectedRoute', redirectCode + '\nfunction ProtectedRoute');
  
  // insert <RedirectOnReload /> inside <BrowserRouter> before <Routes>
  content = content.replace('<Routes>', '<RedirectOnReload />\n        <Routes>');
  
  fs.writeFileSync('src/App.tsx', content);
}
