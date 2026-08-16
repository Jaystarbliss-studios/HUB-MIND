const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Replace "AUDIO" with "AUDIO" as any
code = code.replace(
  /responseModalities: \['AUDIO'\],/g,
  "responseModalities: ['AUDIO'] as any,"
);
code = code.replace(
  /responseModalities: \["AUDIO"\],/g,
  "responseModalities: [\"AUDIO\"] as any,"
);

fs.writeFileSync('server.ts', code);
