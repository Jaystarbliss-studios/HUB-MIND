const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

code = code.replace(
  '<div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">',
  '<div className="absolute top-full right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">'
);

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
