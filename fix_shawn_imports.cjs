const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

code = code.replace(/from '\.\/types'/g, "from '../types'");
code = code.replace(/from '\.\/services\//g, "from '../services/");
code = code.replace(/from '\.\/components\//g, "from './");

fs.writeFileSync('src/components/Shawn.tsx', code);
