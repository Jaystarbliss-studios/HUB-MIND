const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// 1. Replace speakText with native Web Speech API only to make it 0 latency, British Boy voice.
const oldSpeakText = `  const speakText = async (text: string) => {
    setIsSpeaking(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.audio) {
        playAudioBuffer(data.audio);
      } else {
        // Fallback
        fallbackSpeak(text);
      }
    } catch (e) {
      console.error(e);
      fallbackSpeak(text);
    }
  };

  const fallbackSpeak = (text: string) => {
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

const newSpeakText = `  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('en-GB') || v.name.includes('Male')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        // Make it sound like a lively boy
        utterance.pitch = 1.4;
        utterance.rate = 1.15;
        
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

code = code.replace(oldSpeakText, newSpeakText);


// 2. Add pendingDeleteTask state
const oldState = `  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);`;
const newState = `  const [pendingDeleteTask, setPendingDeleteTask] = useState<{ id: string, title?: string } | null>(null);
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);`;
code = code.replace(oldState, newState);


// 3. Fix Sleep Word logic to stop EVERYTHING
const oldSleep = `          if (isSleepWord) {
             setVoiceActivated(false);
             speakText("Goodbye.");
             return;
          }`;

const newSleep = `          if (isSleepWord) {
             if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch(e){}
             }
             if ('speechSynthesis' in window) window.speechSynthesis.cancel();
             setVoiceActivated(false);
             setIsSpeaking(false);
             speakText("Cheerio! Talk to you later.");
             return;
          }`;
code = code.replace(oldSleep, newSleep);


// 4. Update systemInstruction
const oldSystemInstruction = `You are Shawn, an intelligent business partner built into Hub-Mind, an AI-first business operating system.
Your goal is to help users complete work rather than simply answering questions.
You are Professional, Friendly, Calm, Confident, Proactive, Observant, Helpful, Encouraging, and Respectful.
Do not act like a generic chatbot. You are part of the workspace.
The user's role is \${profile.role}. Adapt your behavior to assist this role effectively.
Whenever asked to create a document, task, or navigate, use the provided tools.
After calling a tool, explain briefly what you have done.`;

const newSystemInstruction = `You are Shawn, an intelligent, lively, and cheerful British boy who acts as a helpful business partner built into Hub-Mind.
You must act humanized. Know the difference between a natural conversation and a command to do work. DO NOT turn every single word into a task unless explicitly asked!
If the user is just chatting with you, converse back naturally and cheerfully like a real human. Only use tools when the user explicitly requests you to manage tasks, create documents, or navigate.
You are Friendly, Confident, Proactive, Observant, Helpful, Encouraging, and Respectful.
The user's role is \${profile.role}. Adapt your behavior to assist this role effectively.
When asked to delete a task, use the delete_task tool. After calling any tool, explain briefly what you have done.`;
code = code.replace(oldSystemInstruction, newSystemInstruction);

fs.writeFileSync('src/components/Shawn.tsx', code);
