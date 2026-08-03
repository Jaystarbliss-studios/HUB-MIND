const fs = require('fs');
let content = fs.readFileSync('src/pages/ClientDetail.tsx', 'utf8');

content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/pages/ClientDetail.tsx', content);
