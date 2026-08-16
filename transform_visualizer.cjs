const fs = require('fs');
let code = fs.readFileSync('src/components/AngelOrbVisualizer.tsx', 'utf8');

// Replacements
code = code.replace(/Angel/g, 'Shawn');
code = code.replace(/ANGEL/g, 'SHAWN');
code = code.replace(/Ph\.D\. • M\.D\. • Strategist/g, 'Playful • Curious • Buddy');

// Amber -> Teal
code = code.replace(/amber/g, 'teal');

fs.writeFileSync('src/components/AngelOrbVisualizer.tsx', code);
