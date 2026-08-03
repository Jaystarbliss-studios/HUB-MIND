const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

content = content.replace(
  /className="z-50 w-\[calc\(100vw-32px\)\] sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 data-\[state=closed\]:animate-out data-\[state=closed\]:fade-out data-\[state=closed\]:zoom-out-95 outline-none max-sm:!fixed max-sm:!bottom-4 max-sm:!top-auto max-sm:!left-4 max-sm:!right-4 max-sm:!transform-none max-sm:!w-auto"/,
  'className="z-50 w-[calc(100vw-32px)] sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 outline-none"'
);

// also let's check the auto-rows to make the grid a bit more mobile-friendly
content = content.replace(
  /auto-rows-\[minmax\(120px,1fr\)\]/,
  'auto-rows-[minmax(80px,1fr)] sm:auto-rows-[minmax(120px,1fr)]'
);

fs.writeFileSync('src/pages/Calendar.tsx', content);
console.log('Calendar styles updated');
