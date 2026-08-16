const fs = require('fs');

let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(/Angel/g, 'Shawn');
code = code.replace(/angel/g, 'shawn');
fs.writeFileSync('src/types.ts', code);

// Now fix server.ts endpoint
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(/angelNote/g, 'shawnNote');
fs.writeFileSync('server.ts', serverCode);

