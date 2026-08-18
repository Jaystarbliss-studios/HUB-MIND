import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voicePrintEngine, VoicePrintProfile, VoiceEvaluationResult } from '../lib/voicePrintEngine';
import { useAuth } from '../lib/auth';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Zap,
  Volume2,
  Radio,
  Activity,
  Layers,
  Award,
} from 'lucide-react';

interface VoiceCalibrationProps {
  onClose?: () => void;
}

const CALIBRATION_PARAGRAPH =
  "Shawn, initialize workspace telemetry and synchronize the operations dashboard. Let us review the status of our quarterly projects, verify scheduled client meetings, and organize pending tasks with maximum speed and precision. Every team document and record is accounted for.";

export function VoiceCalibration({ onClose }: VoiceCalibrationProps) {
  const { profile, user } = useAuth();
  const userId = profile?.id || user?.uid || 'user_default';
  
  const [profileData, setProfileData] = useState<VoicePrintProfile>(() =>
    voicePrintEngine.getProfile(userId)
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<VoiceEvaluationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveFrequencies, setLiveFrequencies] = useState<number[]>(new Array(16).fill(0));
  const [audioLevel, setAudioLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync profile data when userId changes
  useEffect(() => {
    setProfileData(voicePrintEngine.getProfile(userId));
  }, [userId]);

  const targetCount = 200;
  const sampleCount = profileData.sampleCount;
  const progressPercent = Math.min(100, Math.round((sampleCount / targetCount) * 100));

  const getStageInfo = (count: number) => {
    if (count >= 200) {
      return {
        stage: 4,
        title: 'Stage 4: Biometric Isolation Active',
        description: 'Voiceprint fully converged. Background voices will be filtered out.',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      };
    }
    if (count >= 120) {
      return {
        stage: 3,
        title: 'Stage 3: Centroid Convergence',
        description: 'Vocal centroid stabilization in progress. Almost ready for biometric lock.',
        color: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
      };
    }
    if (count >= 50) {
      return {
        stage: 2,
        title: 'Stage 2: Pitch & Resonance Mapping',
        description: 'Acoustic feature extraction active. Formant harmonics building.',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      };
    }
    return {
      stage: 1,
      title: 'Stage 1: Initialization',
      description: 'Read the paragraph aloud to begin capturing your voiceprints.',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    };
  };

  const currentStage = getStageInfo(sampleCount);

  // Stop media streams & audio context
  const stopAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setIsTesting(false);
    setAudioLevel(0);
    setLiveFrequencies(new Array(16).fill(0));
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  // Start Calibration Ingestion
  const startCalibrationRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsRecording(true);
      setIsTesting(false);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let sampleThrottle = 0;

      const processFrame = () => {
        analyser.getByteFrequencyData(dataArray);

        // Compute average level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avgLevel = sum / bufferLength / 255;
        setAudioLevel(avgLevel);

        // Extract 16 frequency bands for visualizer
        const bands = voicePrintEngine.extractFeatures(dataArray);
        setLiveFrequencies(bands);

        // Ingest sample if user is actually speaking
        if (avgLevel > 0.08) {
          sampleThrottle++;
          if (sampleThrottle % 3 === 0) {
            const updated = voicePrintEngine.recordSample(userId, dataArray);
            setProfileData(updated);
          }
        }

        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      processFrame();
    } catch (err: any) {
      console.error('Failed to access microphone for calibration', err);
      setErrorMessage(err.message || 'Microphone access is required for voice calibration.');
      setIsRecording(false);
    }
  };

  // Start Voice Verification Test
  const startVerificationTest = async () => {
    setErrorMessage(null);
    setTestResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsTesting(true);
      setIsRecording(false);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const processTestFrame = () => {
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avgLevel = sum / bufferLength / 255;
        setAudioLevel(avgLevel);

        const bands = voicePrintEngine.extractFeatures(dataArray);
        setLiveFrequencies(bands);

        if (avgLevel > 0.1) {
          const res = voicePrintEngine.evaluateVoice(userId, dataArray);
          setTestResult(res);
        }

        animationFrameRef.current = requestAnimationFrame(processTestFrame);
      };

      processTestFrame();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start verification test');
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    stopAudio();
    voicePrintEngine.resetProfile(userId);
    setProfileData(voicePrintEngine.getProfile(userId));
    setTestResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/30 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Personalized Voiceprint Calibration</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300">
                  Biometric Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Enroll 200+ voiceprints so Shawn recognizes your unique voice and rejects background talk.
              </p>
            </div>
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

      {errorMessage && (
        <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Progress & Stage Status */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${currentStage.color}`}>
                {currentStage.title}
              </span>
              {sampleCount >= targetCount && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Enrolled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">{currentStage.description}</p>
          </div>

          <div className="text-right sm:shrink-0">
            <span className="text-2xl font-bold font-mono text-teal-300">{sampleCount}</span>
            <span className="text-xs font-mono text-slate-500"> / {targetCount}+ samples</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-300 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 4 Stage Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] font-mono">
          {[
            { num: 1, label: 'Init (0-50)', active: sampleCount >= 0 },
            { num: 2, label: 'Formants (51-120)', active: sampleCount >= 51 },
            { num: 3, label: 'Centroid (121-199)', active: sampleCount >= 121 },
            { num: 4, label: 'Isolated (200+)', active: sampleCount >= 200 },
          ].map((st) => (
            <div
              key={st.num}
              className={`p-2 rounded-xl border text-center transition ${
                st.active
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-200 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div>Stage {st.num}</div>
              <div className="text-[9px] opacity-75">{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calibration Reading Paragraph */}
      <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-teal-400" />
            <span>Phonetic Calibration Script</span>
          </label>
          <span className="text-[11px] text-slate-500">Read continuously while recording</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 text-sm text-slate-200 leading-relaxed font-sans shadow-inner">
          "{CALIBRATION_PARAGRAPH}"
        </div>

        {/* Live Audio Spectrum Visualizer */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-1.5 h-16 px-4">
          {liveFrequencies.map((band, idx) => {
            const barHeight = Math.max(8, Math.round(band * 48));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-t transition-all duration-75 ${
                    isRecording
                      ? 'bg-gradient-to-t from-teal-500 to-emerald-400'
                      : isTesting
                      ? 'bg-gradient-to-t from-blue-500 to-teal-300'
                      : 'bg-slate-800'
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!isRecording ? (
            <button
              onClick={startCalibrationRecording}
              className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition"
            >
              <Mic className="w-4 h-4" />
              <span>Start Reading Calibration (Capture Voiceprints)</span>
            </button>
          ) : (
            <button
              onClick={stopAudio}
              className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 animate-pulse transition"
            >
              <MicOff className="w-4 h-4" />
              <span>Stop Calibration Recording</span>
            </button>
          )}

          {!isTesting ? (
            <button
              onClick={startVerificationTest}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition"
            >
              <Zap className="w-4 h-4 text-teal-400" />
              <span>Test Voice Isolation</span>
            </button>
          ) : (
            <button
              onClick={stopAudio}
              className="py-3 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-xs flex items-center gap-2 transition"
            >
              <Zap className="w-4 h-4 animate-spin" />
              <span>Stop Test</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-3 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
            title="Reset Voiceprints & Recalibrate"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Verification Test Output Box */}
      {isTesting && testResult && (
        <div
          className={`p-4 rounded-2xl border transition-all ${
            testResult.accepted
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {testResult.accepted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span className="font-bold text-sm">
                {testResult.accepted ? 'Match Confirmed: Authorized User' : 'Voice Disregarded: Low Similarity'}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
              {Math.round(testResult.similarity * 100)}% Match Score
            </span>
          </div>
          <p className="text-xs mt-1.5 opacity-90">{testResult.message}</p>
        </div>
      )}

      {/* Biometric Privacy Safeguards Notice */}
      <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Biometric Privacy & Local Isolation Guarantee</span>
        </div>
        <p className="leading-relaxed">
          Your vocal frequency embeddings and centroid vectors are mathematically normalized and stored on your device.
          No raw audio recordings are kept or shared. You can delete or recalibrate your voiceprint at any time.
        </p>
      </div>
    </div>
  );
}
