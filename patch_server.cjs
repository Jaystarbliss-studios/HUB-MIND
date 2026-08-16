const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /if \(payload\.type === "audio"\) \{[\s\S]*?\} else if \(payload\.type === "text"\) \{[\s\S]*?\} else if \(payload\.type === "video"\) \{[\s\S]*?\}\n          \}/g,
  `if (payload.type === "audio") {
            liveSession.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (payload.type === "text") {
            liveSession.sendRealtimeInput({
              text: payload.text
            });
          } else if (payload.type === "video") {
            liveSession.sendRealtimeInput({
              video: { data: payload.image, mimeType: "image/jpeg" },
            });
          }`
);

fs.writeFileSync('server.ts', code);
