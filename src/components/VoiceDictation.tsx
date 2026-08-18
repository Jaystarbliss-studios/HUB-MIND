import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Check, Sparkles } from 'lucide-react';

interface VoiceDictationProps {
  onTranscript: (text: string, mode: 'append' | 'replace') => void;
  currentValue?: string;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const VoiceDictation: React.FC<VoiceDictationProps> = ({
  onTranscript,
  currentValue = '',
  placeholder = 'Speak notes...',
  className = '',
  size = 'md',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('');
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
          } else {
            interimChunk += event.results[i][0].transcript;
          }
        }

        if (finalChunk) {
          onTranscript(finalChunk.trim(), 'append');
        }
        setInterimText(interimChunk);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition error:', event.error);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition initialization error', e);
      setSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!supported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText('');
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition start failed', err);
      }
    }
  };

  if (!supported) return null;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        title={isListening ? 'Stop voice recording' : 'Dictate voice notes (Speech-to-Text)'}
        className={`relative flex items-center justify-center gap-1.5 transition-all rounded-lg font-medium text-xs ${
          size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5'
        } ${
          isListening
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse shadow-sm shadow-rose-500/20'
            : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-teal-300 border border-slate-700/60'
        }`}
      >
        {isListening ? (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping mr-0.5" />
            <MicOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Listening...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>Dictate</span>
          </>
        )}
      </button>

      {isListening && interimText && (
        <span className="text-xs text-teal-300 bg-slate-900/90 border border-teal-500/30 px-2 py-0.5 rounded italic max-w-xs truncate animate-fade-in">
          "{interimText}"
        </span>
      )}
    </div>
  );
};
