const fs = require('fs');

let shawn = fs.readFileSync('src/components/Shawn.tsx', 'utf8');
shawn = shawn.replace(/AngelState/g, 'ShawnState');
shawn = shawn.replace(/onAngelStateChange:/g, 'onShawnStateChange:');
shawn = shawn.replace(/liveAngelTranscript=/g, 'liveShawnTranscript=');
fs.writeFileSync('src/components/Shawn.tsx', shawn);

let wwd = fs.readFileSync('src/services/wakeWordDetector.ts', 'utf8');
wwd = wwd.replace(/_angel/g, '_shawn');
wwd = wwd.replace(/case 'angel'/g, "case 'shawn'");
fs.writeFileSync('src/services/wakeWordDetector.ts', wwd);

