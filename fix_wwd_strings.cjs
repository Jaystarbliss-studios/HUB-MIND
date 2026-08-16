const fs = require('fs');
let wwd = fs.readFileSync('src/services/wakeWordDetector.ts', 'utf8');
wwd = wwd.replace(/angel/g, 'shawn');
fs.writeFileSync('src/services/wakeWordDetector.ts', wwd);
