const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace(
  "injectRegister: 'auto',",
  "injectRegister: 'auto',\n        devOptions: {\n          enabled: true,\n          type: 'module'\n        },"
);
fs.writeFileSync('vite.config.ts', code);
