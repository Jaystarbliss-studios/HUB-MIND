const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

const oldAudio = `  const playAudioBuffer = (base64Data: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const binary = atob(base64Data);`;

const newAudio = `  const playAudioBuffer = (base64Data: string) => {
    try {
      if (!window.__sharedAudioCtx) {
        window.__sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = window.__sharedAudioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const binary = atob(base64Data);`;

code = code.replace(oldAudio, newAudio);

// Also patch handleSend to pass `voiceActivated` manually so that the ref doesn't capture stale state.
// Wait, handleSend is recreated on every render so it might capture the latest voiceActivated.
// But just in case, we can use a ref for voiceActivated.
const oldVoiceActivated = `  const [voiceActivated, setVoiceActivated] = useState(false);`;
const newVoiceActivated = `  const [voiceActivated, setVoiceActivated] = useState(false);
  const voiceActivatedRef = useRef(voiceActivated);
  useEffect(() => { voiceActivatedRef.current = voiceActivated; }, [voiceActivated]);`;
code = code.replace(oldVoiceActivated, newVoiceActivated);

// Replace voiceActivated checks inside handleSend with voiceActivatedRef.current
const oldSpeakText1 = `          if (voiceActivated) speakText(secondData.text);`;
const newSpeakText1 = `          if (voiceActivatedRef.current) speakText(secondData.text);`;
code = code.replaceAll(oldSpeakText1, newSpeakText1);

const oldSpeakText2 = `           if (voiceActivated) speakText("Done.");`;
const newSpeakText2 = `           if (voiceActivatedRef.current) speakText("Done.");`;
code = code.replaceAll(oldSpeakText2, newSpeakText2);

const oldSpeakText3 = `        if (voiceActivated) speakText(data.text);`;
const newSpeakText3 = `        if (voiceActivatedRef.current) speakText(data.text);`;
code = code.replaceAll(oldSpeakText3, newSpeakText3);

const oldSpeakText4 = `      if (voiceActivated) speakText("I encountered an error.");`;
const newSpeakText4 = `      if (voiceActivatedRef.current) speakText("I encountered an error.");`;
code = code.replaceAll(oldSpeakText4, newSpeakText4);


// Now patch recognition onresult
const oldOnResult = `      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          
          if (transcript.includes('hey shawn') || transcript.includes('hey sean') || transcript.includes('hi shawn')) {
            setVoiceActivated(true);
            setIsOpen(true);
            
            const match = transcript.match(/(?:hey|hi) shawn(.*)/i) || transcript.match(/hey sean(.*)/i);
            const command = match ? match[1].trim() : '';
            
            if (command && command.length > 0 && handleSendRef.current) {
              handleSendRef.current(command);
            } else {
              speakText("I'm here, how can I help?");
            }
          } else if (voiceActivated) {
            if (transcript.length > 0 && handleSendRef.current) {
              handleSendRef.current(transcript);
            }
          }
        }
      };`;

const newOnResult = `      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          
          const isWakeWord = transcript.includes('hey shawn') || transcript.includes('hey sean') || transcript.includes('hi shawn') || transcript.includes('hello shawn') || transcript.includes('hello sean');
          const isSleepWord = transcript.includes('ok shawn') || transcript.includes('bye shawn') || transcript.includes('ok sean') || transcript.includes('bye sean');
          
          if (isSleepWord) {
             setVoiceActivated(false);
             speakText("Goodbye.");
             return;
          }
          
          if (isWakeWord) {
            setVoiceActivated(true);
            setIsOpen(true);
            
            const match = transcript.match(/(?:hey|hi|hello) shawn(.*)/i) || transcript.match(/(?:hey|hi|hello) sean(.*)/i);
            const command = match ? match[1].trim() : '';
            
            if (command && command.length > 0 && handleSendRef.current) {
              handleSendRef.current(command);
            } else {
              speakText("I'm here, how can I help?");
            }
          } else if (voiceActivatedRef.current) {
            if (transcript.length > 0 && handleSendRef.current) {
              handleSendRef.current(transcript);
            }
          }
        }
      };`;

code = code.replace(oldOnResult, newOnResult);

fs.writeFileSync('src/components/Shawn.tsx', code);
