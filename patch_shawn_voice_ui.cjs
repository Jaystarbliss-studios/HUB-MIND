const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// Add interim transcript state
code = code.replace(
  "const [voiceActivated, setVoiceActivated] = useState(false);",
  "const [voiceActivated, setVoiceActivated] = useState(false);\n  const [interimTranscript, setInterimTranscript] = useState('');"
);

// Update recognition to use interim results
const oldEffect = `      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListeningVoice(true);
      
      recognition.onresult = (event: any) => {
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
          }
        }
      };`;

const newEffect = `      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListeningVoice(true);
      
      recognition.onresult = (event: any) => {
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const lowerTrans = transcript.trim().toLowerCase();
            if (lowerTrans.includes('hey shawn') || lowerTrans.includes('hey sean') || lowerTrans.includes('hi shawn')) {
              setVoiceActivated(true);
              setIsOpen(true);
              const match = lowerTrans.match(/(?:hey|hi) shawn(.*)/i) || lowerTrans.match(/hey sean(.*)/i);
              const command = match ? match[1].trim() : '';
              if (command && command.length > 0 && handleSendRef.current) {
                handleSendRef.current(command);
              } else {
                speakText("I'm here, how can I help?");
              }
            } else if (voiceActivated) {
              if (transcript.trim() && handleSendRef.current) {
                handleSendRef.current(transcript.trim());
              }
            }
            setInterimTranscript('');
          } else {
            currentInterim += transcript;
          }
        }
        if (currentInterim) {
           setInterimTranscript(currentInterim);
        }
      };`;

code = code.replace(oldEffect, newEffect);

fs.writeFileSync('src/components/Shawn.tsx', code);
