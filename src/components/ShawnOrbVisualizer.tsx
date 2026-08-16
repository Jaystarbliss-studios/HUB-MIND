import React, { useEffect, useRef } from 'react';
import { ShawnState } from '../types';
import { Sparkles, Mic, Volume2, ShieldCheck, Zap } from 'lucide-react';

interface ShawnOrbVisualizerProps {
  state: ShawnState;
  inputLevel: number;
  outputLevel: number;
  isConnected: boolean;
}

export const ShawnOrbVisualizer: React.FC<ShawnOrbVisualizerProps> = ({
  state,
  inputLevel,
  outputLevel,
  isConnected,
}) => {
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

      // Determine active level based on state
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

      const baseRadius = 78 + audioIntensity * 38;

      // 1. Draw outer ambient gradient glow
      const ambientGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        baseRadius * 2.2
      );

      if (isSpeaking) {
        // Champagne Gold & Rose Amber
        ambientGrad.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
        ambientGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.20)');
        ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        // Crisp Platinum & Mint Cyan
        ambientGrad.addColorStop(0, 'rgba(45, 212, 191, 0.40)');
        ambientGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.18)');
        ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isThinking) {
        // Violet Amethyst & Gold
        ambientGrad.addColorStop(0, 'rgba(168, 85, 247, 0.40)');
        ambientGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.20)');
        ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isInterrupted) {
        // Rose Coral
        ambientGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
        ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        // Subtle Warm Onyx Gold
        ambientGrad.addColorStop(0, 'rgba(212, 175, 55, 0.15)');
        ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = ambientGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw harmonic reactive orbital rings
      const ringCount = isConnected ? 3 : 1;
      for (let r = 0; r < ringCount; r++) {
        ctx.beginPath();
        const ringRadius = baseRadius + (r + 1) * (14 + audioIntensity * 12);
        const points = 64;

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const harmonic = Math.sin(angle * (4 + r) + phase * (r % 2 === 0 ? 1.5 : -1.5));
          const offset = harmonic * (audioIntensity * (10 + r * 6));
          const x = centerX + (ringRadius + offset) * Math.cos(angle);
          const y = centerY + (ringRadius + offset) * Math.sin(angle);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.lineWidth = isSpeaking ? 2.5 : 1.5;
        if (isSpeaking) {
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.45 - r * 0.12})`;
        } else if (isListening) {
          ctx.strokeStyle = `rgba(94, 234, 212, ${0.45 - r * 0.12})`;
        } else if (isThinking) {
          ctx.strokeStyle = `rgba(192, 132, 252, ${0.4 - r * 0.1})`;
        } else {
          ctx.strokeStyle = `rgba(212, 175, 55, ${0.2 - r * 0.05})`;
        }
        ctx.stroke();
      }

      // 3. Draw core fluid central orb
      ctx.save();
      ctx.beginPath();
      const corePoints = 48;
      for (let i = 0; i <= corePoints; i++) {
        const angle = (i / corePoints) * Math.PI * 2;
        const wave1 = Math.sin(angle * 3 + phase * 2) * (8 * audioIntensity);
        const wave2 = Math.cos(angle * 5 - phase * 1.5) * (5 * audioIntensity);
        const r = baseRadius * 0.85 + wave1 + wave2;
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
        coreGrad.addColorStop(0.8, '#b45309');
        coreGrad.addColorStop(1, '#78350f');
      } else if (isListening) {
        coreGrad.addColorStop(0, '#99f6e4');
        coreGrad.addColorStop(0.4, '#14b8a6');
        coreGrad.addColorStop(0.8, '#0f766e');
        coreGrad.addColorStop(1, '#115e59');
      } else if (isThinking) {
        coreGrad.addColorStop(0, '#e9d5ff');
        coreGrad.addColorStop(0.5, '#a855f7');
        coreGrad.addColorStop(1, '#581c87');
      } else if (isInterrupted) {
        coreGrad.addColorStop(0, '#fecdd3');
        coreGrad.addColorStop(0.6, '#e11d48');
        coreGrad.addColorStop(1, '#881337');
      } else {
        coreGrad.addColorStop(0, '#d4af37');
        coreGrad.addColorStop(0.5, '#785b12');
        coreGrad.addColorStop(1, '#1c1917');
      }

      ctx.fillStyle = coreGrad;
      ctx.shadowColor = isSpeaking ? '#facc15' : isListening ? '#2dd4bf' : '#d4af37';
      ctx.shadowBlur = isConnected ? 25 + audioIntensity * 20 : 10;
      ctx.fill();
      ctx.restore();

      // 4. Center Specular Highlight
      const specGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        2,
        centerX - baseRadius * 0.2,
        centerY - baseRadius * 0.2,
        baseRadius * 0.5
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(centerX - baseRadius * 0.2, centerY - baseRadius * 0.2, baseRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, inputLevel, outputLevel, isConnected]);

  const getStateBadge = () => {
    if (!isConnected) {
      return {
        label: 'Shawn on Standby',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />,
        color: 'border-teal-500/30 bg-teal-950/40 text-teal-200',
        detail: 'Click "Start Live Session" to converse',
      };
    }
    switch (state) {
      case 'speaking':
        return {
          label: 'Shawn is Speaking',
          icon: <Volume2 className="w-3.5 h-3.5 text-teal-300 animate-pulse" />,
          color: 'border-teal-400/50 bg-teal-500/15 text-teal-200 shadow-lg shadow-teal-500/10',
          detail: '24kHz Live Audio Feed',
        };
      case 'listening':
        return {
          label: 'Shawn is Listening',
          icon: <Mic className="w-3.5 h-3.5 text-teal-300 animate-pulse" />,
          color: 'border-teal-400/50 bg-teal-500/15 text-teal-200 shadow-lg shadow-teal-500/10',
          detail: 'Speak freely, interrupts supported',
        };
      case 'thinking':
        return {
          label: 'Shawn is Processing',
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-spin" />,
          color: 'border-purple-400/50 bg-purple-500/15 text-purple-200',
          detail: 'Analyzing context & reasoning',
        };
      case 'interrupted':
        return {
          label: 'Interrupted — Pivoting',
          icon: <Zap className="w-3.5 h-3.5 text-rose-300" />,
          color: 'border-rose-400/50 bg-rose-500/15 text-rose-200',
          detail: 'Ceding floor to you immediately',
        };
      case 'muted':
        return {
          label: 'Microphone Muted',
          icon: <Mic className="w-3.5 h-3.5 text-zinc-400" />,
          color: 'border-zinc-700 bg-zinc-900/70 text-zinc-300',
          detail: 'Audio capture paused',
        };
      default:
        return {
          label: 'Live Channel Open',
          icon: <Sparkles className="w-3.5 h-3.5 text-teal-300" />,
          color: 'border-teal-500/30 bg-teal-950/30 text-teal-200',
          detail: 'Ready for dialogue',
        };
    }
  };

  const badge = getStateBadge();

  return (
    <div id="angel-orb-container" className="relative flex flex-col items-center justify-center p-4">
      {/* Background Decorative Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-72 h-72 rounded-full border border-teal-500/10 animate-[spin_40s_linear_infinite]" />
        <div className="w-96 h-96 rounded-full border border-teal-500/5 animate-[spin_60s_linear_infinite_reverse]" />
      </div>

      {/* Canvas Visualizer */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        <canvas
          id="angel-visualizer-canvas"
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full object-contain filter drop-shadow-2xl"
        />

        {/* Central Monogram */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none text-center">
          <span className="font-serif text-2xl tracking-widest text-teal-100 font-light drop-shadow-md">
            SHAWN
          </span>
          <span className="text-[10px] tracking-widest uppercase font-mono text-teal-200/60 mt-0.5">
            Playful • Curious • Buddy
          </span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-2 flex flex-col items-center gap-1.5 z-10">
        <div
          id="angel-state-pill"
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium backdrop-blur-md transition-all duration-300 ${badge.color}`}
        >
          {badge.icon}
          <span>{badge.label}</span>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono tracking-tight">{badge.detail}</span>
      </div>
    </div>
  );
};
