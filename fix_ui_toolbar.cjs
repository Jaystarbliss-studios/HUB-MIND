const fs = require('fs');
let code = fs.readFileSync('src/components/documents/DocumentToolbar.tsx', 'utf8');

code = code.replace(
  '<div className="flex flex-wrap items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shrink-0">',
  '<div className="flex items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>\n<style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>'
);

fs.writeFileSync('src/components/documents/DocumentToolbar.tsx', code);
