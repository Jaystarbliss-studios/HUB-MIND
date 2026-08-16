const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

let lines = code.split('\n');
// We need to replace lines 469 (inclusive) to 486 (inclusive). But lines array is 0-indexed.
// So indices 468 to 485.
lines.splice(468, 18, 
`          if (payload.type === "audio") {
            liveSession.sendRealtimeInput({
              audio: { mimeType: "audio/pcm;rate=16000", data: payload.audio }
            });
          } else if (payload.type === "text") {
            liveSession.send({ message: payload.text });
          } else if (payload.type === "video") {
            liveSession.sendRealtimeInput({
              video: { mimeType: "image/jpeg", data: payload.image }
            });
          }`);

fs.writeFileSync('server.ts', lines.join('\n'));
