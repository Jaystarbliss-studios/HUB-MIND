const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

code = code.replace(
  '<div key={task.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">',
  '<div key={task.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">'
);
code = code.replace(
  '<div className="flex-1 min-w-0">',
  '<div className="flex-1 min-w-0 w-full sm:w-auto">'
);
code = code.replace(
  /<Link \s*to=\{`\/tasks\/\$\{task\.id\}`\}\s*className="text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"\s*>/g,
  '<div className="w-full sm:w-auto flex justify-end mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-800 sm:border-0">\n<Link to={`/tasks/${task.id}`} className="text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap">'
);
code = code.replace(
  '</Link>\n                </div>\n              ))',
  '</Link>\n</div>\n                </div>\n              ))'
);

fs.writeFileSync('src/pages/Tasks.tsx', code);
