const fs = require('fs');

// Patch server.ts
let server = fs.readFileSync('server.ts', 'utf8');
const oldCatch = `    } catch (e: any) {
      console.error("TTS Error:", e);
      res.status(500).json({ error: e.message || "Failed to generate speech." });
    }`;
const newCatch = `    } catch (e: any) {
      if (e.status === 429 || e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        console.warn("TTS Quota exceeded. Using client fallback.");
      } else {
        console.warn("TTS Error. Using client fallback.", e.message);
      }
      res.status(200).json({ fallback: true });
    }`;
server = server.replace(oldCatch, newCatch);
fs.writeFileSync('server.ts', server);

// Patch Shawn.tsx
let shawn = fs.readFileSync('src/components/Shawn.tsx', 'utf8');
const oldFallback = `  const fallbackSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Male')) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.pitch = 1.6;
      utterance.rate = 1.1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };`;
  
const newFallback = `  const fallbackSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Male')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.pitch = 1.6;
        utterance.rate = 1.1;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
      } else {
        setVoiceAndSpeak();
      }
    } else {
      setIsSpeaking(false);
    }
  };`;

shawn = shawn.replace(oldFallback, newFallback);
fs.writeFileSync('src/components/Shawn.tsx', shawn);

console.log("Patched!");
