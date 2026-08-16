const fs = require('fs');
let code = fs.readFileSync('src/services/liveAudioClient.ts', 'utf8');
code = code.replace(/Angel/g, 'Shawn');
code = code.replace(/angel/g, 'shawn');
fs.writeFileSync('src/services/liveAudioClient.ts', code);
