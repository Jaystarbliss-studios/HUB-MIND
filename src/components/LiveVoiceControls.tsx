import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  Sliders,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  Camera,
} from 'lucide-react';
import { AudioSettings, LiveConnectionState } from '../types';

interface LiveVoiceControlsProps {
  connectionState: LiveConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isPushToTalk: boolean;
  onTogglePushToTalk: (enabled: boolean) => void;
  onPushToTalkActive: (active: boolean) => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
  onSendImageFrame: (base64Jpeg: string) => void;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: Partial<AudioSettings>) => void;
  inputLevel: number;
  outputLevel: number;
}

export const LiveVoiceControls: React.FC<LiveVoiceControlsProps> = ({
  connectionState,
  onConnect,
  onDisconnect,
  isMuted,
  onToggleMute,
  isPushToTalk,
  onTogglePushToTalk,
  onPushToTalkActive,
  isCameraActive,
  onToggleCamera,
  onSendImageFrame,
  audioSettings,
  onUpdateAudioSettings,
  inputLevel,
  outputLevel,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isHoldingPtt, setIsHoldingPtt] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Setup video stream safely when camera is active
  useEffect(() => {
    let isMounted = true;

    const setupCamera = async () => {
      if (!isCameraActive) {
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach((track) => track.stop());
          videoStreamRef.current = null;
        }
        if (videoRef.current) {
          try {
            videoRef.current.pause();
          } catch (e) {
            // ignore
          }
          videoRef.current.srcObject = null;
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        videoStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', 'true');
          
          try {
            await videoRef.current.play();
          } catch (err: any) {
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
              console.debug('Video playback notice:', err);
            }
          }
        }

        // Send visual snapshot frames to Shawn regularly (1 every 1.2 seconds)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Immediate snapshot after camera stabilizes
        setTimeout(() => {
          if (videoRef.current && ctx && videoRef.current.videoWidth > 0 && isMounted) {
            canvas.width = 480;
            canvas.height = 360;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
            onSendImageFrame(base64);
          }
        }, 600);

        frameIntervalRef.current = window.setInterval(() => {
          if (videoRef.current && ctx && videoRef.current.videoWidth > 0 && isMounted) {
            canvas.width = 480;
            canvas.height = 360;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
            onSendImageFrame(base64);
          }
        }, 1200);
      } catch (err: any) {
        if (isMounted) {
          console.warn('Failed to access camera stream:', err?.message || err);
          if (isCameraActive) {
            onToggleCamera();
          }
        }
      }
    };

    setupCamera();

    return () => {
      isMounted = false;
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch (e) {
          // ignore
        }
        videoRef.current.srcObject = null;
      }
    };
  }, [isCameraActive, onSendImageFrame, onToggleCamera]);

  // Spacebar push-to-talk handler
  useEffect(() => {
    if (!isPushToTalk || connectionState !== 'connected') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsHoldingPtt(true);
        onPushToTalkActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsHoldingPtt(false);
        onPushToTalkActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPushToTalk, connectionState, onPushToTalkActive]);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <div id="live-voice-controls-panel" className="w-full flex flex-col items-center gap-4">
      {/* Video Context PIP Preview if Camera is Active */}
      {isCameraActive && (
        <div className="relative w-64 max-w-full aspect-[4/3] rounded-2xl overflow-hidden border border-teal-500/40 bg-slate-950 shadow-2xl shadow-teal-950/40 animate-in fade-in zoom-in-95 duration-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-teal-500/30 text-[10px] font-mono text-teal-200 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Shawn Vision Active</span>
          </div>
          <button
            id="close-camera-pip-btn"
            onClick={onToggleCamera}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition shadow-md"
            title="Stop Video Stream"
          >
            <VideoOff className="w-3.5 h-3.5" />
          </button>
          <div className="absolute bottom-2 left-2 right-2 text-center text-[9px] font-mono text-slate-300 bg-black/60 backdrop-blur-sm rounded-lg py-0.5">
            Streaming visual frames to Gemini Live
          </div>
        </div>
      )}

      {/* Primary Control Bar */}
      <div className="flex items-center gap-3 p-2 rounded-full bg-slate-900/90 border border-teal-500/20 backdrop-blur-xl shadow-2xl shadow-black/80">
        {/* Settings Toggle */}
        <button
          id="toggle-audio-settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-3 rounded-full transition duration-200 ${
            showSettings
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-teal-200 hover:bg-slate-800/80'
          }`}
          title="Audio & Voice Configuration"
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Camera Toggle */}
        <button
          id="toggle-live-camera-btn"
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition duration-200 ${
            isCameraActive
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-teal-200 hover:bg-slate-800/80'
          }`}
          title={isCameraActive ? 'Disable Vision Stream' : 'Share Vision Stream with Shawn'}
        >
          {isCameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Main Connect / Disconnect Call Button */}
        {isConnected ? (
          <button
            id="disconnect-call-btn"
            onClick={onDisconnect}
            className="group relative flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-medium shadow-lg shadow-rose-900/50 transition-all duration-200 active:scale-95"
          >
            <PhoneOff className="w-5 h-5 transition-transform group-hover:rotate-12" />
            <span className="font-sans text-sm tracking-wide">End Session</span>
          </button>
        ) : (
          <button
            id="connect-call-btn"
            disabled={isConnecting}
            onClick={onConnect}
            className={`group relative flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all duration-300 active:scale-95 shadow-xl ${
              isConnecting
                ? 'bg-teal-800 text-teal-200 cursor-wait'
                : 'bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-semibold shadow-teal-500/30'
            }`}
          >
            {isConnecting ? (
              <>
                <Sparkles className="w-5 h-5 animate-spin" />
                <span className="font-sans text-sm">Connecting with Shawn...</span>
              </>
            ) : (
              <>
                <PhoneCall className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span className="font-sans text-sm tracking-wide">Start Live Dialogue</span>
              </>
            )}
          </button>
        )}

        {/* Mic Mute / Push to Talk */}
        {isConnected && !isPushToTalk && (
          <button
            id="toggle-mic-mute-btn"
            onClick={onToggleMute}
            className={`p-3 rounded-full transition duration-200 ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}

        {/* Push to Talk Button (if PTT mode active) */}
        {isConnected && isPushToTalk && (
          <button
            id="push-to-talk-hold-btn"
            onMouseDown={() => {
              setIsHoldingPtt(true);
              onPushToTalkActive(true);
            }}
            onMouseUp={() => {
              setIsHoldingPtt(false);
              onPushToTalkActive(false);
            }}
            onTouchStart={() => {
              setIsHoldingPtt(true);
              onPushToTalkActive(true);
            }}
            onTouchEnd={() => {
              setIsHoldingPtt(false);
              onPushToTalkActive(false);
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-mono text-xs font-semibold select-none transition-all ${
              isHoldingPtt
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/40 scale-105'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isHoldingPtt ? 'animate-pulse' : ''}`} />
            <span>{isHoldingPtt ? 'Transmitting' : 'Hold / Space'}</span>
          </button>
        )}
      </div>

      {/* Dual Real-time Level Monitors */}
      {isConnected && (
        <div className="flex items-center gap-6 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Your Mic</span>
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(inputLevel * 180))}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Shawn Output</span>
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(outputLevel * 180))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Audio & Persona Settings Drawer */}
      {showSettings && (
        <div
          id="audio-settings-drawer"
          className="w-full max-w-md p-5 rounded-2xl bg-slate-900/95 border border-teal-500/30 backdrop-blur-xl shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              <h4 className="text-sm font-medium text-slate-100">Live Voice & Wake Word</h4>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>

          {/* Wake Word Fast Configuration */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs font-semibold text-slate-200">Voice Wake Word</span>
              </div>
              <button
                onClick={() => {
                  const currentWw = audioSettings.wakeWord || {
                    enabled: true,
                    selectedPreset: 'hey_shawn',
                    customKeyword: '',
                    sensitivity: 'medium',
                    autoRespond: true,
                    wakeGreetingPrompt: "I'm here. What's on your mind?",
                    soundFeedback: true,
                  };
                  onUpdateAudioSettings({
                    wakeWord: { ...currentWw, enabled: !currentWw.enabled },
                  });
                }}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                  audioSettings.wakeWord?.enabled !== false
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {audioSettings.wakeWord?.enabled !== false ? 'Active' : 'Off'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'hey_shawn', label: 'Hey Shawn' },
                { id: 'wake_up_shawn', label: 'Wake up Shawn' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => {
                const currentWw = audioSettings.wakeWord || {
                  enabled: true,
                  selectedPreset: 'hey_shawn',
                  customKeyword: '',
                  sensitivity: 'medium',
                  autoRespond: true,
                  wakeGreetingPrompt: "I'm here. What's on your mind?",
                  soundFeedback: true,
                };
                const isSelected = currentWw.selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onUpdateAudioSettings({
                        wakeWord: { ...currentWw, selectedPreset: p.id as any, enabled: true },
                      });
                    }}
                    className={`py-1 px-2 rounded-lg text-[10px] font-mono border transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-500/15 text-teal-300 font-semibold'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Personality Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Shawn's Voice Profile</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Kore', label: 'Kore (Default)', desc: 'Refined, cultured, warm' },
                { id: 'Aoede', label: 'Aoede', desc: 'Melodic, sharp, confident' },
                { id: 'Zephyr', label: 'Zephyr', desc: 'Airy, energetic, playful' },
                { id: 'Fenrir', label: 'Fenrir', desc: 'Deep, resonant, grounded' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => onUpdateAudioSettings({ voice: v.id })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    audioSettings.voice === v.id
                      ? 'border-teal-500 bg-teal-500/10 text-teal-200'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-200">{v.label}</div>
                  <div className="text-[10px] text-slate-500">{v.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Volume and Gain sliders */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Microphone Gain</span>
                <span>{Math.round(audioSettings.micGain * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={audioSettings.micGain}
                onChange={(e) => onUpdateAudioSettings({ micGain: parseFloat(e.target.value) })}
                className="w-full accent-teal-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Output Volume</span>
                <span>{Math.round(audioSettings.outputVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={audioSettings.outputVolume}
                onChange={(e) => onUpdateAudioSettings({ outputVolume: parseFloat(e.target.value) })}
                className="w-full accent-teal-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Push-to-Talk Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-xs font-medium text-slate-200">Push-to-Talk Mode</div>
              <div className="text-[10px] text-slate-500">Hold spacebar or on-screen button to transmit</div>
            </div>
            <button
              onClick={() => onTogglePushToTalk(!isPushToTalk)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                isPushToTalk ? 'bg-teal-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isPushToTalk ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
