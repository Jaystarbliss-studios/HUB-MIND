const fs = require('fs');
let code = fs.readFileSync('src/services/liveAudioClient.ts', 'utf8');

code = code.replace(
  /this\.playAudioChunk\(data\.audio\);/g,
  "console.log('Received audio chunk from server, length:', data.audio.length);\n            this.playAudioChunk(data.audio);"
);

code = code.replace(
  /if \(!this\.outputAudioCtx \|\| !this\.outputGainNode\) return;/g,
  "if (!this.outputAudioCtx || !this.outputGainNode) { console.warn('Cannot play audio: outputAudioCtx or outputGainNode missing'); return; }\n    if (this.outputAudioCtx.state === 'suspended') { console.warn('AudioContext is suspended! Audio will not play unless resumed by a user gesture.'); }"
);

fs.writeFileSync('src/services/liveAudioClient.ts', code);
