const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

code = code.replace(
  "if (!window.confirm('Are you sure you want to delete this document?')) return;",
  "// Removed window.confirm due to iframe restrictions"
);

fs.writeFileSync('src/pages/Documents.tsx', code);
