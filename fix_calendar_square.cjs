const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

// Replace auto-rows
content = content.replace(
  /auto-rows-\[minmax\(80px,1fr\)\] sm:auto-rows-\[minmax\(120px,1fr\)\]/,
  'auto-rows-fr'
);

// Add aspect-square to empty cells
content = content.replace(
  /key=\{\`empty-\$\{i\}\`\} className="bg-slate-950\/30"/,
  'key={`empty-${i}`} className="bg-slate-950/30 aspect-square"'
);

// Add aspect-square to day cells (button)
content = content.replace(
  /className=\{\`p-3 transition-colors hover:bg-slate-800\/50 flex flex-col items-stretch text-left h-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent \$\{/,
  'className={`aspect-square p-3 transition-colors hover:bg-slate-800/50 flex flex-col items-stretch text-left h-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent ${'
);

// Replace Popover.Content classes to ensure it renders correctly on mobile
// The previous issue was that side="right" forces it to the right, which might cut off if the screen is narrow.
// We can use collision boundary or let Radix handle it, but wait: we should set side="bottom" on mobile or just let Radix auto-flip.
// Actually, `max-sm:!fixed max-sm:!bottom-4 ...` was there previously but the user said "modal that pops up shows on the screen.. the current one has half of the right side outside the screen". 
// Wait, the previous code I removed had max-sm:!fixed, which centered it! But it might have been wrong because I removed it in a previous fix, and that's when the user started complaining?
// Let's check what was the problem. The user says:
// "Also please make sure that the modal that pops up shows on the screen.. the current one has half of the right side outside the screen"
// If side="right" is used without side="top" or without enough space, Radix UI tries to fit it, but maybe it exceeds the width.
// We can change side to "bottom" or use `sideOffset` and `align="center"` with `max-w-full`.
// If we add `max-w-[calc(100vw-32px)]` and `collisionBoundary`, maybe it fits.
fs.writeFileSync('src/pages/Calendar.tsx', content);
