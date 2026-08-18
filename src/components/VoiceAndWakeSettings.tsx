import React, { useState, useEffect, useRef } from 'react';
import {
  AudioSettings,
  WakeWordConfig,
  WakeWordPreset,
} from '../types';
import { WakeWordDetector } from '../services/wakeWordDetector';
import { VoiceCalibration } from './VoiceCalibration';
import {
  Mic,
  Radio,
  Sliders,
  Sparkles,
  Volume2,
  Bell,
  CheckCircle2,
  Edit3,
  Flame,
  VolumeX,
  RefreshCw,
  Zap,
  Info,
  Shield,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

interface VoiceAndWakeSettingsProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void;
  onClose?: () => void;
}

export const VoiceAndWakeSettings: React.FC<VoiceAndWakeSettingsProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'wake' | 'calibration'>('wake');
  const [testingMic, setTestingMic] = useState(false);
  const [testTranscript, setTestTranscript] = useState('');
  const [testMatchDetected, setTestMatchDetected] = useState(false);
  const [testMatchedPhrase, setTestMatchedPhrase] = useState('');
  const testDetectorRef = useRef<WakeWordDetector | null>(null);

  const wakeWord = settings.wakeWord || {
    enabled: true,
    selectedPreset: 'hey_shawn',
    customKeyword: '',
    sensitivity: 'medium',
    autoRespond: true,
    wakeGreetingPrompt: "I'm here. What's on your mind?",
    soundFeedback: true,
  };

  const handleUpdateWakeWord = (partial: Partial<WakeWordConfig>) => {
    const updated = { ...wakeWord, ...partial };
    onUpdateSettings({ wakeWord: updated });
  };

  // Preset definitions
  const presets: {
    id: WakeWordPreset;
    title: string;
    description: string;
    examples: string[];
  }[] = [
    {
      id: 'hey_shawn',
      title: 'Hey Shawn',
      description: 'Custom trigger for Shawn/Sean',
      examples: ['"Hey Shawn"', '"Hey, Sean"'],
    },
    {
      id: 'hey_shawn',
      title: 'Hey Shawn',
      description: 'The signature executive call sign',
      examples: ['"Hey Shawn"', '"Hey, Shawn"', '"Shawn"'],
    },
    {
      id: 'wake_up_shawn',
      title: 'Wake up Shawn',
      description: 'Definitive command phrase',
      examples: ['"Wake up Shawn"', '"Shawn wake up"'],
    },
    {
      id: 'hello_shawn',
      title: 'Hello Shawn',
      description: 'Warm & formal conversational greeting',
      examples: ['"Hello Shawn"', '"Hello, Shawn"'],
    },
    {
      id: 'hi_shawn',
      title: 'Hi Shawn',
      description: 'Quick casual conversational opener',
      examples: ['"Hi Shawn"', '"Hi, Shawn"'],
    },
    {
      id: 'shawn',
      title: 'Shawn (Short)',
      description: 'Single-word immediate trigger',
      examples: ['"Shawn"'],
    },
    {
      id: 'custom',
      title: 'Custom Keyword',
      description: 'Define your own tailored wake phrase',
      examples: ['e.g., "Doctor Shawn", "Oracle", "My Strategist"'],
    },
  ];

  // Stop testing when unmounting
  useEffect(() => {
    return () => {
      if (testDetectorRef.current) {
        testDetectorRef.current.stop();
      }
    };
  }, []);

  // Handle Testing Mic
  const toggleTestMic = () => {
    if (testingMic) {
      if (testDetectorRef.current) {
        testDetectorRef.current.stop();
        testDetectorRef.current = null;
      }
      setTestingMic(false);
    } else {
      setTestTranscript('');
      setTestMatchDetected(false);
      setTestMatchedPhrase('');

      const detector = new WakeWordDetector({
        ...wakeWord,
        enabled: true,
      });

      detector.setCallbacks({
        onWake: (res) => {
          setTestMatchDetected(true);
          setTestMatchedPhrase(res.matchedPhrase);
          setTestTranscript(res.fullTranscript);
          setTimeout(() => {
            setTestMatchDetected(false);
          }, 3000);
        },
        onInterim: (text, matched) => {
          setTestTranscript(text);
          if (matched) {
            setTestMatchDetected(true);
            setTimeout(() => setTestMatchDetected(false), 3000);
          }
        },
        onStatus: (listening, err) => {
          if (err) {
            console.warn('Test mic status err:', err);
          }
          setTestingMic(listening);
        },
      });

      const started = detector.start();
      if (started) {
        testDetectorRef.current = detector;
        setTestingMic(true);
      }
    }
  };

  const handlePlaySampleChime = () => {
    const detector = new WakeWordDetector(wakeWord);
    detector.playWakeChime();
  };

  return (
    <div
      id="voice-wake-settings-container"
      className="flex flex-col h-full rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>Wake Word & Voice Intelligence Settings</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300">
                Hands-Free
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure how Shawn listens, detects your voice command keyword, and isolates your unique vocal identity.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Done
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 pt-3 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('wake')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'wake'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Wake Word & Recognition</span>
        </button>

        <button
          onClick={() => setActiveTab('calibration')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'calibration'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Voiceprint Calibration (200+ Samples)</span>
        </button>
      </div>

      {/* Main Settings Body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6">
        {activeTab === 'calibration' ? (
          <VoiceCalibration />
        ) : (
          <>
            {/* Master Wake Word Activation Switch */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Voice Wake Word Activation</span>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                  wakeWord.enabled
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {wakeWord.enabled ? 'Active & Listening' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              When enabled, saying your configured wake word anywhere in the app will automatically wake Shawn and start live conversation.
            </p>
          </div>

          <button
            id="toggle-wake-word-master-btn"
            onClick={() => handleUpdateWakeWord({ enabled: !wakeWord.enabled })}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
              wakeWord.enabled ? 'bg-gradient-to-r from-teal-500 to-teal-400' : 'bg-slate-800'
            }`}
          >
            <div
              className={`bg-slate-950 w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center ${
                wakeWord.enabled ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
              }`}
            >
              <Mic className={`w-3 h-3 ${wakeWord.enabled ? 'text-teal-400' : 'text-slate-800'}`} />
            </div>
          </button>
        </div>

        {/* Wake Word Keyword Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-teal-400" />
              <span>Select Wake Phrase / Trigger Keyword</span>
            </label>
            <span className="text-[11px] font-mono text-slate-500">
              Active Phrase: <span className="text-teal-300 font-semibold">{presets.find(p => p.id === wakeWord.selectedPreset)?.title}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((preset) => {
              const isSelected = wakeWord.selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  id={`preset-${preset.id}`}
                  onClick={() => handleUpdateWakeWord({ selectedPreset: preset.id })}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-teal-500/15 border-teal-500/60 shadow-lg shadow-teal-500/10 text-slate-100 ring-1 ring-teal-500/40'
                      : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-100">{preset.title}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mb-2">{preset.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {preset.examples.map((ex, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800/80 text-teal-200/80"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Keyword Input if 'custom' preset selected */}
          {wakeWord.selectedPreset === 'custom' && (
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-teal-200">Custom Wake Keyword</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Type the exact word or phrase you want to say to activate Shawn (e.g. "Doctor Shawn", "Oracle", "Hey Mentor").
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={wakeWord.customKeyword}
                  onChange={(e) => handleUpdateWakeWord({ customKeyword: e.target.value })}
                  placeholder="Enter custom phrase, e.g. Doctor Shawn..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-teal-500/40 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateWakeWord({ customKeyword: wakeWord.customKeyword || 'Doctor Shawn' })}
                  className="px-3 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-medium transition"
                >
                  Save Keyword
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Wake Word Tester & Sensitivity Tuning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sensitivity */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-slate-200">Detection Sensitivity</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase capitalize">
                {wakeWord.sensitivity}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Adjust how strictly the voice engine matches your wake word.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'low', label: 'Strict (Low)', sub: 'Lowest false triggers' },
                { id: 'medium', label: 'Balanced (Med)', sub: 'Recommended' },
                { id: 'high', label: 'Fast (High)', sub: 'Instant pickup' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleUpdateWakeWord({ sensitivity: s.id as any })}
                  className={`p-2 rounded-xl border text-center transition ${
                    wakeWord.sensitivity === s.id
                      ? 'border-teal-500 bg-teal-500/15 text-teal-200 font-semibold'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs">{s.label}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{s.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback & Chime */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-slate-200">Wake-Up Sound & Feedback</span>
              </div>
              <button
                onClick={handlePlaySampleChime}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 flex items-center gap-1 transition"
                title="Play triple-harmonic chime"
              >
                <Volume2 className="w-3 h-3" />
                <span>Test Chime</span>
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Play acoustic chime when activated</span>
                <input
                  type="checkbox"
                  checked={wakeWord.soundFeedback}
                  onChange={(e) => handleUpdateWakeWord({ soundFeedback: e.target.checked })}
                  className="accent-teal-400 w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Shawn immediately responds verbally upon wake</span>
                <input
                  type="checkbox"
                  checked={wakeWord.autoRespond}
                  onChange={(e) => handleUpdateWakeWord({ autoRespond: e.target.checked })}
                  className="accent-teal-400 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Live Interactive Wake Word Tester Box */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-500/10 via-slate-950 to-slate-950 border border-teal-500/30 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-slate-100">Live Keyword Recognition Simulator</span>
            </div>
            <button
              id="test-wake-word-btn"
              onClick={toggleTestMic}
              className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition ${
                testingMic
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                  : 'bg-teal-500 text-slate-950 font-semibold hover:bg-teal-400 shadow-md shadow-teal-500/20'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{testingMic ? 'Stop Mic Test' : 'Test Your Wake Word Live'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Click "Test Your Wake Word Live" and say{' '}
            <strong className="text-teal-300">
              {wakeWord.selectedPreset === 'custom' && wakeWord.customKeyword
                ? `"${wakeWord.customKeyword}"`
                : `"${presets.find(p => p.id === wakeWord.selectedPreset)?.title}"`}
            </strong>{' '}
            into your microphone to verify detection and see live acoustic parsing.
          </p>

          {testingMic && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Speech Engine Listening...
                </span>
                {testMatchDetected && (
                  <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-950 font-bold flex items-center gap-1 animate-bounce">
                    <CheckCircle2 className="w-3 h-3" />
                    MATCH DETECTED: "{testMatchedPhrase}"
                  </span>
                )}
              </div>

              <div className="text-xs font-mono text-slate-200 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 min-h-[36px] flex items-center">
                {testTranscript ? (
                  <span className="text-teal-200">{testTranscript}</span>
                ) : (
                  <span className="text-slate-600 italic">Say your wake word now...</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Voice Personality Models & Audio Sliders */}
        <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-semibold text-slate-100">Shawn's Voice Model & Acoustics</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'Kore', label: 'Kore (Default)', desc: 'Refined, cultured, warm' },
              { id: 'Aoede', label: 'Aoede', desc: 'Melodic, sharp, confident' },
              { id: 'Zephyr', label: 'Zephyr', desc: 'Airy, energetic, playful' },
              { id: 'Fenrir', label: 'Fenrir', desc: 'Deep, resonant, grounded' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => onUpdateSettings({ voice: v.id })}
                className={`p-3 rounded-xl border text-left transition ${
                  settings.voice === v.id
                    ? 'border-teal-500 bg-teal-500/15 text-teal-200 ring-1 ring-teal-500/40'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-100">{v.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{v.desc}</div>
              </button>
            ))}
          </div>

          {/* Volume and Gain sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Microphone Gain</span>
                <span>{Math.round((settings.micGain || 1.0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={settings.micGain || 1.0}
                onChange={(e) => onUpdateSettings({ micGain: parseFloat(e.target.value) })}
                className="w-full accent-teal-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Output Volume</span>
                <span>{Math.round((settings.outputVolume || 1.0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={settings.outputVolume || 1.0}
                onChange={(e) => onUpdateSettings({ outputVolume: parseFloat(e.target.value) })}
                className="w-full accent-teal-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
