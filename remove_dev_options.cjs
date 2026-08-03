const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace(
  /\s*devOptions:\s*\{\s*enabled:\s*true\s*(?:,\s*type:\s*'module'\s*)?\},/,
  ""
);
fs.writeFileSync('vite.config.ts', code);
