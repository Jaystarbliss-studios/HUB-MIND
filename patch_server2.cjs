const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(payload\.type === "audio"\) \{[\s\S]*?\} else if \(payload\.type === "text"\) \{[\s\S]*?\} else if \(payload\.type === "video"\) \{[\s\S]*?\n\s*\}/g;

code = code.replace(regex, 
`if (payload.type === "audio") {
            liveSession.sendRealtimeInput([{
              mimeType: "audio/pcm;rate=16000",
              data: payload.audio
            }]);
          } else if (payload.type === "text") {
            liveSession.send({ message: payload.text });
          } else if (payload.type === "video") {
            liveSession.sendRealtimeInput([{
              mimeType: "image/jpeg",
              data: payload.image
            }]);
          }`);

fs.writeFileSync('server.ts', code);
