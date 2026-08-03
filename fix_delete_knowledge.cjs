const fs = require('fs');
let code = fs.readFileSync('src/pages/Knowledge.tsx', 'utf8');

code = code.replace(
  "if (!window.confirm('Are you sure you want to delete this article?')) return;",
  "// Removed window.confirm due to iframe restrictions"
);

fs.writeFileSync('src/pages/Knowledge.tsx', code);
