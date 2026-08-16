const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace("hmr: process.env.DISABLE_HMR !== 'true',", "hmr: false,");
fs.writeFileSync('vite.config.ts', code);
