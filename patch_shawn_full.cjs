const fs = require('fs');

const shawnCode = `
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Maximize2, Minimize2, Menu, Shrink, Expand, Mic, MicOff, MessageSquare, 
  Send, Sparkles, StopCircle, RefreshCw
} from 'lucide-react';
import { LiveAudioClient } from '../services/liveAudioClient';
import { AngelOrbVisualizer } from './AngelOrbVisualizer';
import { ChatDrawer } from './ChatDrawer';
import { LiveVoiceControls } from './LiveVoiceControls';

function LogoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2a8 8 0 0 0-8 8c0 5.4 4.8 9.6 7.1 11.4a1.5 1.5 0 0 0 1.8 0C15.2 19.6 20 15.4 20 10a8 8 0 0 0-8-8z" />
      <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

export function Shawn() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Chat and Voice State
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  
  // Live API State
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [angelState, setAngelState] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'muted'>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Transcripts
  const [liveUserTranscript, setLiveUserTranscript] = useState("");
  const [liveAngelTranscript, setLiveAngelTranscript] = useState("");
  
  const liveClientRef = useRef<LiveAudioClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveUserTranscript, liveAngelTranscript]);

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
        liveClientRef.current = null;
      }
      setIsVoiceMode(false);
      setConnectionState('disconnected');
      setAngelState('idle');
    } else {
      setIsVoiceMode(true);
      setErrorMessage(null);
      
      const client = new LiveAudioClient({
        onStatusChange: setConnectionState,
        onAngelStateChange: setAngelState,
        onUserTranscript: (text) => setLiveUserTranscript(prev => (prev ? \`\${prev} \${text}\` : text)),
        onAngelTranscript: (text) => setLiveAngelTranscript(prev => (prev ? \`\${prev} \${text}\` : text)),
        onTurnComplete: () => {
          setLiveUserTranscript((u) => {
            if (u.trim()) {
              setMessages(prev => [...prev, { role: 'user', content: u.trim() }]);
            }
            return '';
          });
          setLiveAngelTranscript((a) => {
            if (a.trim()) {
              setMessages(prev => [...prev, { role: 'model', content: a.trim() }]);
            }
            return '';
          });
        },
        onError: setErrorMessage,
        onAudioLevel: (inLvl, outLvl) => {
          setInputLevel(inLvl);
          setOutputLevel(outLvl);
        },
      });
      liveClientRef.current = client;
      await client.connect();
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    
    const userMsg = inputText;
    setInputText("");
    
    if (isVoiceMode && liveClientRef.current) {
       liveClientRef.current.sendText(userMsg);
       setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    } else {
       setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
       try {
         const res = await fetch('/api/chat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             messages: [...messages, { role: 'user', parts: [{ text: userMsg }] }],
             systemInstruction: "You are Shawn, an intelligent business partner."
           })
         });
         const data = await res.json();
         if (data.text) {
           setMessages(prev => [...prev, { role: 'model', content: data.text }]);
         }
       } catch (err) {
         console.error(err);
       }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[100] p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 bg-accent hover:bg-accent-hover text-slate-950"
      >
        <LogoIcon className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className={\`fixed z-[100] bg-slate-900 border border-slate-700 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden \${
      isFullScreen 
        ? 'inset-4 rounded-2xl' 
        : isMinimized
          ? 'bottom-6 right-6 w-72 h-14 rounded-xl'
          : 'bottom-6 right-6 w-[400px] h-[600px] rounded-2xl'
    }\`}>
      {/* Header */}
      <div className="bg-slate-800 p-3 flex items-center justify-between border-b border-slate-700 cursor-pointer" onClick={() => isMinimized && setIsMinimized(false)}>
        <div className="flex items-center gap-3">
          <div className="bg-accent p-1.5 rounded-lg">
            <LogoIcon className="w-5 h-5 text-slate-950" />
          </div>
          <div>
             <span className="font-bold text-white">Shawn</span>
             {!isMinimized && <p className="text-xs text-slate-400">{connectionState === 'connected' ? 'Live Voice Active' : 'Intelligent Assistant'}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }} className="p-1 text-slate-400 hover:text-white rounded">
            {isFullScreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1 text-slate-400 hover:text-white rounded">
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {isVoiceMode && connectionState === 'connected' ? (
                <div className="flex flex-col items-center justify-center h-full gap-8">
                   <div className="w-48 h-48">
                     <AngelOrbVisualizer 
                        state={angelState} 
                        inputLevel={inputLevel} 
                        outputLevel={outputLevel} 
                        colorTheme="amber"
                     />
                   </div>
                   <div className="text-center max-w-xs space-y-2">
                     <p className="text-sm text-slate-400 uppercase tracking-widest">{angelState}</p>
                     {liveUserTranscript && <p className="text-white">"{liveUserTranscript}"</p>}
                     {liveAngelTranscript && <p className="text-accent">"{liveAngelTranscript}"</p>}
                   </div>
                </div>
             ) : (
                <div className="space-y-4 pb-4">
                  {messages.map((m, i) => (
                    <div key={i} className={\`flex \${m.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
                      <div className={\`max-w-[80%] rounded-2xl px-4 py-2 \${m.role === 'user' ? 'bg-accent text-slate-950' : 'bg-slate-800 text-slate-200'}\`}>
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
             )}
          </div>

          {/* Controls */}
          <div className="p-4 border-t border-slate-700 bg-slate-900/90 backdrop-blur-md">
            <div className="flex gap-2 items-center">
               <button 
                 onClick={toggleVoiceMode}
                 className={\`p-3 rounded-xl transition \${isVoiceMode ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}\`}
               >
                 {isVoiceMode ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
               </button>
               
               <div className="flex-1 relative">
                 <input
                   type="text"
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSendText()}
                   placeholder={isVoiceMode ? "Type to interrupt..." : "Message Shawn..."}
                   className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-accent text-sm"
                 />
                 <button 
                   onClick={handleSendText}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-accent hover:bg-accent/10 rounded-lg"
                 >
                   <Send className="w-4 h-4" />
                 </button>
               </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/components/Shawn.tsx', shawnCode);
