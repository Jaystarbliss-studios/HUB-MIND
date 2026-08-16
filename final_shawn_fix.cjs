const fs = require('fs');

let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

code = code.replace(/import { AngelOrbVisualizer } from '\.\/AngelOrbVisualizer';/g, "import { ShawnOrbVisualizer } from './ShawnOrbVisualizer';");
code = code.replace(/import { AngelVault } from '\.\/AngelVault';/g, "import { ShawnVault } from './ShawnVault';");

// Usage replacements
code = code.replace(/<AngelOrbVisualizer/g, "<ShawnOrbVisualizer");
code = code.replace(/<AngelVault/g, "<ShawnVault");

// Reverting variables in Shawn.tsx to use shawn... wait I changed types.ts to have ShawnState etc.
// Let's verify what types.ts actually has now.
fs.writeFileSync('src/components/Shawn.tsx', code);
