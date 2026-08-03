const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const cleanupCode = `
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Remove splash screen when app is ready
const removeSplash = () => {
  const splash = document.getElementById('pwa-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      if (splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, 500);
  }
};

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// We can remove the splash screen right after render, or wait a bit
setTimeout(removeSplash, 100);
`;

fs.writeFileSync('src/main.tsx', cleanupCode);
