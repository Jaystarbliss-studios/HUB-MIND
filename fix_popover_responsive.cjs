const fs = require('fs');

let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

// Fix Popover.Content classes
content = content.replace(
  /className="z-50 w-\[calc\(100vw-32px\)\] sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 data-\[state=closed\]:animate-out data-\[state=closed\]:fade-out data-\[state=closed\]:zoom-out-95 outline-none fixed sm:absolute bottom-4 sm:bottom-auto left-4 sm:left-auto right-4 sm:right-auto"/,
  'className="z-50 w-[calc(100vw-32px)] sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 outline-none max-sm:!fixed max-sm:!bottom-4 max-sm:!top-auto max-sm:!left-4 max-sm:!right-4 max-sm:!transform-none max-sm:!w-auto"'
);

fs.writeFileSync('src/pages/Calendar.tsx', content);
