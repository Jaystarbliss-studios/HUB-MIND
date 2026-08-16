const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');
code = code.replace('Crown,', 'Smile,');
fs.writeFileSync('src/components/Shawn.tsx', code);
