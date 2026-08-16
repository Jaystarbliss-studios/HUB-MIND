const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Fix types and callbacks
code = code.replace(/ShawnState/g, 'AngelState');
code = code.replace(/onShawnStateChange/g, 'onAngelStateChange');
code = code.replace(/sender: 'shawn'/g, "sender: 'angel'");
code = code.replace(/"wake_up_shawn"/g, '"wake_up_angel"');
code = code.replace(/"hello_shawn"/g, '"hello_angel"');
code = code.replace(/"hi_shawn"/g, '"hi_angel"');
code = code.replace(/preset === 'shawn'/g, "preset === 'angel'");
code = code.replace(/"shawn"/g, '"angel"');

// Fix the "sender: 'angel'" literal error caused by a previous blanket replace
// But ensure we keep UI text as 'Shawn'
// e.g. "Shawn" string literals that got affected...
// actually, I will just fix the compiler errors manually for those lines
fs.writeFileSync('src/components/Shawn.tsx', code);
