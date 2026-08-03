const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Replace the nav to be scrollable
content = content.replace(
  /<nav className="md:hidden fixed bottom-0 w-full border-t border-slate-800 bg-slate-950\/90 backdrop-blur flex justify-around p-2 pb-safe z-30">/,
  '<nav className="md:hidden fixed bottom-0 w-full border-t border-slate-800 bg-slate-950/90 backdrop-blur flex overflow-x-auto snap-x hide-scrollbar p-2 pb-safe z-30">'
);

// We should also make sure each item takes a minimum width so it doesn't just shrink too much.
// The inner NavLink class:
content = content.replace(
  /"flex flex-col items-center p-2 text-\[10px\] font-medium transition-colors relative",/,
  '"flex flex-col items-center p-2 text-[10px] font-medium transition-colors relative min-w-[72px] snap-center shrink-0",'
);

// Remove the slice
content = content.replace(
  /\{navItems\.slice\(0, 5\)\.map\(\(item\) => \(/,
  '{navItems.map((item) => ('
);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Mobile nav updated');
