const fs = require('fs');
let code = fs.readFileSync('src/services/liveAudioClient.ts', 'utf8');

code = code.replace(
  /this\.sourceNode = this\.inputAudioCtx\.createMediaStreamSource\(this\.mediaStream\);/g,
  "if (!this.inputAudioCtx) throw new Error('inputAudioCtx is null after getUserMedia');\n      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);"
);

// We also need to fix disconnect so it doesn't set inputAudioCtx to null while connecting
// Maybe just use a flag isConnecting? Or we can just let disconnect close it.
// Actually, if we just check if this.inputAudioCtx is null, and if so, return early in connect?
// Wait, if disconnect is called, it cleans up everything. The remaining await will throw or error, we just return.
code = code.replace(
  /this\.mediaStream = await navigator\.mediaDevices\.getUserMedia\(\{[^]*?\}\);/g,
  "this.mediaStream = await navigator.mediaDevices.getUserMedia({\n        audio: {\n          channelCount: 1,\n          sampleRate: 16000,\n          echoCancellation: true,\n          noiseSuppression: true,\n          autoGainControl: true,\n        },\n      });\n      if (!this.inputAudioCtx) return; // aborted by disconnect"
);

fs.writeFileSync('src/services/liveAudioClient.ts', code);
