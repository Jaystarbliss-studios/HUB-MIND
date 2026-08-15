const fs = require('fs');

// 1. Patch Shawn.tsx (playAudioBuffer and JSON Schema)
let shawn = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// A. playAudioBuffer
const oldAudio = `  const playAudioBuffer = (base64Data: string) => {
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (e) {
      console.error("Audio playback error:", e);
      setIsSpeaking(false);
    }
  };`;
  
const newAudio = `  const playAudioBuffer = (base64Data: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const binary = atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => { setIsSpeaking(false); };
      source.start();
      setIsSpeaking(true);
    } catch (e) {
      console.error("Audio playback error:", e);
      setIsSpeaking(false);
    }
  };`;
shawn = shawn.replace(oldAudio, newAudio);

// B. JSON schema casing
shawn = shawn.replace(/type: "OBJECT"/g, 'type: "object"');
shawn = shawn.replace(/type: "STRING"/g, 'type: "string"');

fs.writeFileSync('src/components/Shawn.tsx', shawn);


// 2. Patch server.ts (Model selection)
let server = fs.readFileSync('server.ts', 'utf8');
// Fix candidateModels
server = server.replace(
  'const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash"];',
  'const candidateModels = ["gemini-pro-latest", "gemini-3.1-pro-preview", "gemini-3.7-flash"];'
);

fs.writeFileSync('server.ts', server);

console.log("Patched successfully!");
