const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const splashScreen = `
    <div id="root">
      <style>
        #pwa-splash {
          position: fixed;
          inset: 0;
          background-color: #0f172a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          transition: opacity 0.5s ease-out;
        }
        .pwa-logo {
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
          animation: pwa-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pwa-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .7; transform: scale(0.95); }
        }
        .pwa-title {
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }
        .pwa-subtitle {
          color: #94a3b8;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
        }
      </style>
      <div id="pwa-splash">
        <svg class="pwa-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
          <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
          <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
          <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
          <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
          <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
          <path d="M6 18a4 4 0 0 1-1.967-.516"/>
          <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
        </svg>
        <h1 class="pwa-title">Hub-Mind</h1>
        <p class="pwa-subtitle">Loading Workspace...</p>
      </div>
    </div>
`;

code = code.replace('<div id="root"></div>', splashScreen);
fs.writeFileSync('index.html', code);
