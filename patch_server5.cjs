const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /liveSession\.send\(\{ message: payload\.text \}\);/g,
  "liveSession.sendRealtimeInput({ text: payload.text });"
);

fs.writeFileSync('server.ts', code);
