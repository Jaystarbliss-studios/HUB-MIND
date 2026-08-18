import React, { useEffect, useRef, useState } from 'react';
import { ShawnState } from '../types';
import { Sparkles, Mic, Volume2, ShieldCheck, Zap, Maximize2, Minimize2 } from 'lucide-react';

interface ShawnOrbVisualizerProps {
  state: ShawnState;
  inputLevel: number;
  outputLevel: number;
  isConnected: boolean;
  compact?: boolean;
}

export const ShawnOrbVisualizer: React.FC<ShawnOrbVisualizerProps> = ({
  state,
  inputLevel,
  outputLevel,
  isConnected,
  compact = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      phase += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      const isSpeaking = state === 'speaking';
      const isListening = state === 'listening';
      const isThinking = state === 'thinking';
      const isInterrupted = state === 'interrupted';

      const audioIntensity = isSpeaking
        ? Math.min(1.2, outputLevel * 2.8 + 0.15)
        : isListening
        ? Math.min(1.0, inputLevel * 2.5 + 0.08)
        : isThinking
        ? 0.35 + Math.sin(phase * 2) * 0.15
        : 0.12;

      if (!isExpanded) {
        // --- COMPACT MINIMAL WAVEFORM & COMPACT NODE (High Space-Efficiency) ---
        const barCount = 32;
        const barWidth = (width - 40) / barCount;
        const startX = 20;

        // Draw dynamic reactive audio bars
        for (let i = 0; i < barCount; i++) {
          const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
          const curve = 1 - distFromCenter * 0.5;
          const harmonic = Math.sin(phase * 3 + i * 0.35);
          const barHeight = Math.max(
            4,
            (audioIntensity * 32 + (isConnected ? 6 : 2)) * curve + harmonic * (isSpeaking || isListening ? 8 : 2)
          );

          const x = startX + i * barWidth;
          const y = centerY - barHeight / 2;

          const barGrad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          if (isSpeaking) {
            barGrad.addColorStop(0, '#fef08a');
            barGrad.addColorStop(0.5, '#eab308');
            barGrad.addColorStop(1, '#b45309');
          } else if (isListening) {
            barGrad.addColorStop(0, '#99f6e4');
            barGrad.addColorStop(0.5, '#14b8a6');
            barGrad.addColorStop(1, '#0f766e');
          } else if (isThinking) {
            barGrad.addColorStop(0, '#e9d5ff');
            barGrad.addColorStop(0.5, '#a855f7');
            barGrad.addColorStop(1, '#581c87');
          } else {
            barGrad.addColorStop(0, '#5eead4');
            barGrad.addColorStop(1, '#0f766e');
          }

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(x + 1, y, Math.max(2, barWidth - 2), barHeight, 2);
          ctx.fill();
        }

        // Draw central pulsating core
        const miniRadius = 14 + audioIntensity * 8;
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, miniRadius);
        if (isSpeaking) {
          coreGrad.addColorStop(0, '#fde047');
          coreGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        } else if (isListening) {
          coreGrad.addColorStop(0, '#5eead4');
          coreGrad.addColorStop(1, 'rgba(20, 184, 166, 0)');
        } else {
          coreGrad.addColorStop(0, '#2dd4bf');
          coreGrad.addColorStop(1, 'rgba(13, 148, 136, 0)');
        }
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, miniRadius, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // --- EXPANDED HOLOGRAPHIC ORB (Medium Height) ---
        const baseRadius = 55 + audioIntensity * 28;

        // Ambient Gradient
        const ambientGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          baseRadius * 0.4,
          centerX,
          centerY,
          baseRadius * 2.0
        );

        if (isSpeaking) {
          ambientGrad.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
          ambientGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.20)');
          ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (isListening) {
          ambientGrad.addColorStop(0, 'rgba(45, 212, 191, 0.40)');
          ambientGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.18)');
          ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (isThinking) {
          ambientGrad.addColorStop(0, 'rgba(168, 85, 247, 0.40)');
          ambientGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.20)');
          ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (isInterrupted) {
          ambientGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
          ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          ambientGrad.addColorStop(0, 'rgba(212, 175, 55, 0.15)');
          ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = ambientGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 2.0, 0, Math.PI * 2);
        ctx.fill();

        // Orbital Ring
        ctx.beginPath();
        const ringRadius = baseRadius + (12 + audioIntensity * 8);
        const points = 48;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const harmonic = Math.sin(angle * 4 + phase * 1.5);
          const offset = harmonic * (audioIntensity * 8);
          const x = centerX + (ringRadius + offset) * Math.cos(angle);
          const y = centerY + (ringRadius + offset) * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isSpeaking ? 'rgba(250, 204, 21, 0.4)' : 'rgba(94, 234, 212, 0.4)';
        ctx.stroke();

        // Core Fluid Central Orb
        ctx.save();
        ctx.beginPath();
        const corePoints = 36;
        for (let i = 0; i <= corePoints; i++) {
          const angle = (i / corePoints) * Math.PI * 2;
          const wave1 = Math.sin(angle * 3 + phase * 2) * (6 * audioIntensity);
          const r = baseRadius * 0.85 + wave1;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const coreGrad = ctx.createLinearGradient(
          centerX - baseRadius,
          centerY - baseRadius,
          centerX + baseRadius,
          centerY + baseRadius
        );

        if (isSpeaking) {
          coreGrad.addColorStop(0, '#fef08a');
          coreGrad.addColorStop(0.4, '#eab308');
          coreGrad.addColorStop(1, '#78350f');
        } else if (isListening) {
          coreGrad.addColorStop(0, '#99f6e4');
          coreGrad.addColorStop(0.4, '#14b8a6');
          coreGrad.addColorStop(1, '#115e59');
        } else if (isThinking) {
          coreGrad.addColorStop(0, '#e9d5ff');
          coreGrad.addColorStop(0.5, '#a855f7');
          coreGrad.addColorStop(1, '#581c87');
        } else {
          coreGrad.addColorStop(0, '#2dd4bf');
          coreGrad.addColorStop(0.5, '#0f766e');
          coreGrad.addColorStop(1, '#042f2e');
        }

        ctx.fillStyle = coreGrad;
        ctx.shadowColor = isSpeaking ? '#facc15' : '#2dd4bf';
        ctx.shadowBlur = isConnected ? 16 + audioIntensity * 12 : 8;
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, inputLevel, outputLevel, isConnected, isExpanded]);

  const getStateBadge = () => {
    if (!isConnected) {
      return {
        label: 'Shawn Standby',
        icon: <ShieldCheck className="w-3 h-3 text-teal-300" />,
        color: 'border-teal-500/30 bg-teal-950/40 text-teal-200',
      };
    }
    switch (state) {
      case 'speaking':
        return {
          label: 'Shawn Speaking',
          icon: <Volume2 className="w-3 h-3 text-amber-300 animate-pulse" />,
          color: 'border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-sm shadow-amber-500/10',
        };
      case 'listening':
        return {
          label: 'Listening (Interruptible)',
          icon: <Mic className="w-3 h-3 text-teal-300 animate-pulse" />,
          color: 'border-teal-400/50 bg-teal-500/15 text-teal-200 shadow-sm shadow-teal-500/10',
        };
      case 'thinking':
        return {
          label: 'Processing Context',
          icon: <Sparkles className="w-3 h-3 text-purple-300 animate-spin" />,
          color: 'border-purple-400/50 bg-purple-500/15 text-purple-200',
        };
      case 'interrupted':
        return {
          label: 'Pivoting Floor',
          icon: <Zap className="w-3 h-3 text-rose-300" />,
          color: 'border-rose-400/50 bg-rose-500/15 text-rose-200',
        };
      case 'muted':
        return {
          label: 'Mic Muted',
          icon: <Mic className="w-3 h-3 text-zinc-400" />,
          color: 'border-zinc-700 bg-zinc-900/70 text-zinc-300',
        };
      default:
        return {
          label: 'Live Channel Active',
          icon: <Sparkles className="w-3 h-3 text-teal-300" />,
          color: 'border-teal-500/30 bg-teal-950/30 text-teal-200',
        };
    }
  };

  const badge = getStateBadge();

  return (
    <div
      id="angel-orb-container"
      className={`relative w-full flex flex-col items-center justify-center px-4 py-2 transition-all duration-300 ${
        isExpanded ? 'min-h-[160px]' : 'min-h-[72px]'
      }`}
    >
      {/* Header Bar with State Badge & Size Toggle */}
      <div className="w-full max-w-lg flex items-center justify-between gap-2 z-10">
        <div
          id="angel-state-pill"
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium backdrop-blur-md transition-all ${badge.color}`}
        >
          {badge.icon}
          <span>{badge.label}</span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800/80 transition text-xs flex items-center gap-1"
          title={isExpanded ? 'Switch to Compact Waveform' : 'Switch to Expanded Hologram'}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="text-[10px] font-mono">{isExpanded ? 'Compact' : 'Expanded'}</span>
        </button>
      </div>

      {/* Canvas Visualizer */}
      <div
        className={`relative w-full max-w-lg flex items-center justify-center transition-all duration-300 ${
          isExpanded ? 'h-36' : 'h-14'
        }`}
      >
        <canvas
          id="angel-visualizer-canvas"
          ref={canvasRef}
          width={440}
          height={isExpanded ? 144 : 56}
          className="w-full h-full object-contain filter drop-shadow"
        />
      </div>
    </div>
  );
};
