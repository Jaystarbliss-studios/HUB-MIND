import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceDictationProps {
  onTranscript: (transcript: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  placeholder?: string;
}

export function VoiceDictation({
  onTranscript,
  size = 'md',
  className = '',
}: VoiceDictationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          onTranscript(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech start error:', err);
        setIsListening(false);
      }
    }
  };

  if (!isSupported) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-1.5 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-2.5',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`inline-flex items-center font-medium rounded-lg transition-all cursor-pointer ${
        isListening
          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 animate-pulse'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
      } ${sizeClasses} ${className}`}
      title={isListening ? 'Stop Voice Recording' : 'Start Voice Dictation'}
    >
      {isListening ? (
        <>
          <MicOff className={`${iconSizes} animate-bounce text-white`} />
          <span>Recording... (Click to stop)</span>
        </>
      ) : (
        <>
          <Mic className={`${iconSizes} text-teal-400`} />
          <span>Dictate</span>
        </>
      )}
    </button>
  );
}
