import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Sparkles, Mic, MicOff, Radio, AudioWaveform } from 'lucide-react';
import { LogoIcon } from './LogoIcon';

interface ChatDrawerProps {
  onSendMessage: (text: string, imageBase64?: string) => void;
  isLoading: boolean;
  isConnectedLive: boolean;
  onToggleLiveVoiceMode?: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  onSendMessage,
  isLoading,
  isConnectedLive,
  onToggleLiveVoiceMode,
}) => {
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechInterim, setSpeechInterim] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API Speech Recognition for Voice to Text dictation
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInputText((prev) => {
            const separator = prev && !prev.endsWith(' ') ? ' ' : '';
            return `${prev}${separator}${finalTranscript}`;
          });
          setSpeechInterim('');
        } else {
          setSpeechInterim(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListeningSpeech(false);
        }
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
        setSpeechInterim('');
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition not available:', e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleVoiceToText = () => {
    if (!speechSupported) {
      alert('Voice-to-text recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListeningSpeech) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // ignore
      }
      setIsListeningSpeech(false);
      setSpeechInterim('');
    } else {
      try {
        recognitionRef.current?.start();
        setIsListeningSpeech(true);
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMsg = `${inputText} ${speechInterim}`.trim();
    if (!finalMsg && !imagePreview) return;

    if (isListeningSpeech) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // ignore
      }
      setIsListeningSpeech(false);
      setSpeechInterim('');
    }

    onSendMessage(finalMsg, imagePreview || undefined);
    setInputText('');
    setSpeechInterim('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="chat-input-panel" className="w-full p-2.5 sm:p-3 bg-slate-950/80 border-t border-slate-800/80">
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-1.5 p-1.5 sm:p-2 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl focus-within:border-teal-500/50 transition-colors"
      >
        {/* Image Attachment Preview */}
        {imagePreview && (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-teal-500/40 bg-black/50 ml-2 mt-1">
            <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Voice-to-Text Interim Banner */}
        {isListeningSpeech && (
          <div className="px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center gap-2 text-xs text-teal-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono text-[10px] uppercase font-bold text-rose-400">Listening:</span>
            <span className="italic truncate">{speechInterim || 'Speak clearly into your microphone...'}</span>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Image Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
            id="chat-image-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-teal-300 hover:bg-slate-800/80 rounded-xl transition"
            title="Attach Image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Voice-to-Text Speech Dictation Button */}
          <button
            type="button"
            onClick={toggleVoiceToText}
            className={`p-2 rounded-xl transition flex items-center justify-center ${
              isListeningSpeech
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                : 'text-slate-400 hover:text-teal-300 hover:bg-slate-800/80'
            }`}
            title={
              isListeningSpeech
                ? 'Stop dictation'
                : 'Dictate message with speech-to-text'
            }
          >
            {isListeningSpeech ? <Mic className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Live Voice Mode Toggle */}
          {onToggleLiveVoiceMode && (
            <button
              type="button"
              onClick={onToggleLiveVoiceMode}
              className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-semibold ${
                isConnectedLive
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 animate-pulse'
                  : 'text-slate-400 hover:text-teal-300 hover:bg-slate-800/80'
              }`}
              title={isConnectedLive ? 'Live Voice Active' : 'Start Live Voice Session'}
            >
              <Radio className="w-4 h-4" />
            </button>
          )}

          {/* Text Input */}
          <input
            type="text"
            id="chat-message-text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isListeningSpeech
                ? "Listening..."
                : isConnectedLive
                ? "Send message or talk to Shawn..."
                : "Ask Shawn anything..."
            }
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2 py-1.5 min-w-0"
          />

          {/* Send Button */}
          <button
            id="chat-send-btn"
            type="submit"
            disabled={isLoading || (!inputText.trim() && !speechInterim && !imagePreview)}
            className="p-2 sm:px-3 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-semibold text-xs flex items-center gap-1 transition disabled:opacity-40 active:scale-95 shadow-md shadow-teal-500/20 shrink-0"
          >
            {isLoading ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
