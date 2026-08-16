const fs = require('fs');
let code = fs.readFileSync('tsconfig.json', 'utf8');
if (!code.includes('"exclude"')) {
  code = code.replace(/}$/, '  ,"exclude": ["dist"]\n}');
  fs.writeFileSync('tsconfig.json', code);
}
