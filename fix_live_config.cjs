const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /systemInstruction: {/g,
  "responseModalities: ['AUDIO'],\n          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },\n          systemInstruction: {"
);
fs.writeFileSync('server.ts', code);
