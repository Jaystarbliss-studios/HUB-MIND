const fs = require('fs');
let code = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

code = code.replace(
  '<div key={doc.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">',
  '<div key={doc.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">'
);
code = code.replace(
  '<div className="flex items-start gap-4 min-w-0">',
  '<div className="flex items-start gap-4 min-w-0 w-full sm:w-auto">'
);
code = code.replace(
  '<div className="flex items-center gap-2">',
  '<div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-800 sm:border-0">'
);
code = code.replace(
  '<div className="p-3 bg-slate-800 rounded-xl text-slate-400 hidden sm:block">',
  '<div className="p-3 bg-slate-800 rounded-xl text-slate-400 hidden sm:block shrink-0">'
);

fs.writeFileSync('src/pages/Documents.tsx', code);
