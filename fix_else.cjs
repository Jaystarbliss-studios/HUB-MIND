const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

code = code.replace(/} else { else {/g, '} else {');

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
