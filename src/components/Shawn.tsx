import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveConnectionState,
  ShawnState,
  ChatMessage,
  AudioSettings,
} from '../types';
import { LiveAudioClient } from '../services/liveAudioClient';
import { WakeWordDetector } from '../services/wakeWordDetector';
import { ShawnOrbVisualizer } from './ShawnOrbVisualizer';
import { LiveVoiceControls } from './LiveVoiceControls';
import { TranscriptView } from './TranscriptView';
import { ChatDrawer } from './ChatDrawer';
import {
  Sparkles,
  Smile,
  X,
  Maximize2,
  Shrink,
  Expand,
  Zap,
  Shield,
} from 'lucide-react';

export function Shawn() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Connection & Live Audio State
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('disconnected');
  const [shawnState, setShawnState] = useState<ShawnState>('idle');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wake Word Detection State
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [wakeWordFlashMessage, setWakeWordFlashMessage] = useState<string | null>(null);
  const wakeWordDetectorRef = useRef<WakeWordDetector | null>(null);

  // Transcripts & Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveUserTranscript, setLiveUserTranscript] = useState<string>('');
  const [liveShawnTranscript, setLiveShawnTranscript] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const audioSettings = {
    voice: 'Puck',
    micGain: 1.0,
    outputVolume: 1.0,
    pushToTalk: false,
    noiseSuppression: true,
    echoCancellation: true,
    wakeWord: {
      enabled: true,
      selectedPreset: 'hey_shawn' as any,
      customKeyword: '',
      sensitivity: 'medium' as any,
      autoRespond: true,
      wakeGreetingPrompt: "Hey there! Ready to play?",
      soundFeedback: true,
    },
  };

  const liveClientRef = useRef<LiveAudioClient | null>(null);

  useEffect(() => {
    const isLiveActive = connectionState === 'connected';
    const isWwEnabled = audioSettings.wakeWord?.enabled !== false;

    if (!isWwEnabled || isLiveActive) {
      if (wakeWordDetectorRef.current) {
        wakeWordDetectorRef.current.stop();
        wakeWordDetectorRef.current = null;
      }
      return;
    }

    const detector = new WakeWordDetector(audioSettings.wakeWord);
    detector.setCallbacks({
      onWake: (res) => {
        setWakeWordDetected(true);
        setWakeWordFlashMessage(`Keyword "${res.matchedPhrase}" detected! Waking Shawn...`);
        setTimeout(() => {
          setWakeWordDetected(false);
          setWakeWordFlashMessage(null);
        }, 3000);

        handleConnectLive();

        if (res.remainingPrompt && res.remainingPrompt.trim()) {
          setTimeout(() => {
            handleSendMessage(res.remainingPrompt);
          }, 800);
        }
      },
      onStatus: (listening, err) => {
        if (err) console.debug('Wake word status notice:', err);
      },
    });

    detector.start();
    wakeWordDetectorRef.current = detector;

    return () => {
      if (wakeWordDetectorRef.current) {
        wakeWordDetectorRef.current.stop();
        wakeWordDetectorRef.current = null;
      }
    };
  }, [audioSettings.wakeWord, connectionState]);

  const handleDisconnectLive = useCallback(() => {
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    setConnectionState('disconnected');
    setShawnState('idle');
    setLiveUserTranscript('');
    setLiveShawnTranscript('');
  }, []);

  const handleConnectLive = async () => {
    setErrorMessage(null);
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
    }

    const client = new LiveAudioClient({
      onStatusChange: (status) => {
        setConnectionState(status);
      },
      onShawnStateChange: (state) => {
        setShawnState(state);
      },
      onUserTranscript: (text) => {
        setLiveUserTranscript((prev) => {
          const t = prev ? `${prev} ${text}` : text;
          // Sleep check
          const lct = t.toLowerCase();
          if (lct.includes('bye shawn') || lct.includes('bye sean') || lct.includes('sleep shawn') || lct.includes('goodbye shawn')) {
            setTimeout(() => {
               handleDisconnectLive();
               setIsOpen(false);
            }, 1000);
          }
          return t;
        });
      },
      onShawnTranscript: (text) => {
        setLiveShawnTranscript((prev) => (prev ? `${prev} ${text}` : text));
      },
      onError: (err) => setErrorMessage(err),
      onAudioLevel: (input, output) => { setInputLevel(input); setOutputLevel(output); },
      onTurnComplete: () => {
        setLiveUserTranscript((u) => {
          if (u.trim()) {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now()}-u`,
                sender: 'user',
                text: u.trim(),
                timestamp: new Date().toISOString(),
              },
            ]);
          }
          return '';
        });
        setLiveShawnTranscript((a) => {
          if (a.trim()) {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now()}-a`,
                sender: 'shawn',
                text: a.trim(),
                timestamp: new Date().toISOString(),
              },
            ]);
          }
          return '';
        });
      },
          });

    liveClientRef.current = client;

    try {
      await client.connect();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to Live API.');
      setConnectionState('error');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    if (connectionState === 'connected' && liveClientRef.current) {
      liveClientRef.current.sendText(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'user',
          text,
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsChatLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()+1}`,
          sender: 'shawn',
          text: data.text,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch AI response');
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearTranscript = () => {
    setMessages([]);
    setLiveUserTranscript('');
    setLiveShawnTranscript('');
  };

  if (!isOpen) {
    const isLive = connectionState === 'connected';
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-[100] p-4 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 ${isLive ? 'bg-gradient-to-br from-teal-400 to-teal-500 animate-pulse ring-4 ring-teal-500/50' : 'bg-gradient-to-br from-teal-500 to-teal-600'} text-slate-950`}
      >
        <Smile className="w-6 h-6" />
        {isLive && (
           <span className="absolute -top-1 -right-1 flex h-3 w-3">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
           </span>
        )}
      </button>
    );
  }

  return (
    <div className={`fixed z-[100] transition-all duration-300 overflow-hidden shadow-2xl flex flex-col bg-slate-950 text-slate-100 font-sans ${
      isFullScreen 
        ? 'inset-4 rounded-3xl' 
        : 'bottom-6 right-6 w-[95vw] md:w-[450px] lg:w-[500px] h-[85vh] rounded-2xl'
    }`}>
      <div className="absolute top-2 right-2 flex items-center gap-2 z-50">
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg backdrop-blur-md border border-slate-700 transition">
          {isFullScreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>
        <button onClick={() => setIsOpen(false)} className="p-1.5 bg-indigo-900/50 hover:bg-indigo-900/80 text-indigo-200 rounded-lg backdrop-blur-md border border-indigo-800 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-teal-600/10 via-emerald-700/5 to-transparent blur-3xl rounded-full" />
          <div className="absolute -bottom-40 left-1/4 w-[500px] h-[400px] bg-gradient-to-t from-teal-900/10 to-transparent blur-3xl rounded-full" />
        </div>

        {wakeWordFlashMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-teal-500/20 border border-teal-500/50 text-teal-300 px-4 py-2 rounded-full backdrop-blur-md shadow-lg shadow-teal-900/20 flex items-center gap-2 text-sm font-medium">
              <Zap className="w-4 h-4 text-teal-400" />
              {wakeWordFlashMessage}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="m-4 bg-red-900/30 border border-red-800/50 text-red-300 p-4 rounded-xl flex items-start gap-3 backdrop-blur-sm z-10 relative">
            <Shield className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
            <div>
              <p className="font-semibold text-sm">Connection Error</p>
              <p className="text-sm opacity-80 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="relative z-10 p-6 flex flex-col items-center justify-center min-h-[220px]">
          <div className="mb-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent drop-shadow-sm flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" /> Shawn
            </h2>
            <p className="text-slate-400 text-xs text-center mt-1 uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5">
              <span>Playful</span> &bull; <span>Curious</span> &bull; <span>Buddy</span>
            </p>
          </div>

          <div className="relative transform hover:scale-105 transition-transform duration-500 ease-out">
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 blur-2xl rounded-full" />
            <ShawnOrbVisualizer
              state={shawnState}
              inputLevel={inputLevel}
              outputLevel={outputLevel}
              isConnected={connectionState === 'connected'}
            />
          </div>

          <div className="mt-8 flex justify-center w-full z-10">
            <LiveVoiceControls
              connectionState={connectionState}
              isMuted={isMuted}
              isPushToTalk={isPushToTalk}
              onConnect={handleConnectLive}
              onDisconnect={handleDisconnectLive}
              onToggleMute={() => setIsMuted(!isMuted)}
              onTogglePushToTalk={(val) => setIsPushToTalk(val)}
              onPushToTalkActive={() => {}}
              isCameraActive={isCameraActive}
              onToggleCamera={() => setIsCameraActive(!isCameraActive)}
              onSendImageFrame={() => {}}
              audioSettings={audioSettings}
              onUpdateAudioSettings={() => {}}
              inputLevel={inputLevel}
              outputLevel={outputLevel}
            />
          </div>
        </div>

        <div className="flex-1 relative z-10 flex flex-col bg-slate-900/60 backdrop-blur-md border-t border-slate-800 rounded-t-3xl overflow-hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
          <TranscriptView
            messages={messages}
            liveUserTranscript={liveUserTranscript}
            liveShawnTranscript={liveShawnTranscript}
            isLiveActive={connectionState === 'connected'}
            onClearTranscript={clearTranscript}
            onSaveToVault={async () => {}}
            onPlayTTS={async () => {}}
          />
          <ChatDrawer
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            isConnectedLive={connectionState === 'connected'}
          />
        </div>
      </div>
    </div>
  );
}
