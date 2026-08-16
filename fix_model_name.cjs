const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/gemini-2.0-flash-exp/g, "gemini-2.5-flash");
fs.writeFileSync('server.ts', code);
