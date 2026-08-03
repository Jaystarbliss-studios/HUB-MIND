const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

content = content.replace(
  /side="right"\s*align="start"/,
  'side="bottom"\n                    align="center"\n                    avoidCollisions={true}'
);

content = content.replace(
  /w-\[calc\(100vw-32px\)\] sm:w-80/,
  'w-[calc(100vw-32px)] max-w-sm sm:w-80'
);

fs.writeFileSync('src/pages/Calendar.tsx', content);
