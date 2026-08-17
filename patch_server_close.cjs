const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /clientWs\.close\(\);\s*\}/g,
  "setTimeout(() => { if (clientWs.readyState === 1) clientWs.close(); }, 500); }"
);

fs.writeFileSync('server.ts', code);
