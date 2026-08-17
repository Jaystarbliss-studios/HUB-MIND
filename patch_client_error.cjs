const fs = require('fs');
let code = fs.readFileSync('src/services/liveAudioClient.ts', 'utf8');

code = code.replace(
  /if \(this\.callbacks\.onError\) this\.callbacks\.onError\(data\.message \|\| 'Live session error'\);/g,
  "if (this.callbacks.onError) this.callbacks.onError(data.message || 'Live session error');\n            this.callbacks.onStatusChange('error');"
);

fs.writeFileSync('src/services/liveAudioClient.ts', code);
