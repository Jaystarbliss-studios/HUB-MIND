import React, { useEffect, useRef } from 'react';
import type { JessState } from '../services/liveAudioClient';

export function JessOrbVisualizer({ state, inputLevel, outputLevel, connected }: { state: JessState; inputLevel: number; outputLevel: number; connected: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame = 0; let phase = 0;
    const draw = () => {
      phase += 0.045; const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const w = Math.max(1, Math.floor(rect.width * dpr)), h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2; const speaking = state === 'speaking', listening = state === 'listening', thinking = state === 'thinking', interrupted = state === 'interrupted', error = state === 'error';
      const level = speaking ? Math.min(1, outputLevel * 3 + .12) : listening ? Math.min(1, inputLevel * 3 + .08) : thinking ? .35 + Math.sin(phase * 2) * .12 : interrupted || error ? .2 : .12;
      const r = Math.min(w, h) * .22 + level * Math.min(w, h) * .07; const glow = ctx.createRadialGradient(cx, cy, r * .2, cx, cy, r * 2.1);
      glow.addColorStop(0, error ? 'rgba(244,63,94,.30)' : speaking ? 'rgba(255,255,255,.32)' : listening ? 'rgba(94,234,212,.28)' : thinking ? 'rgba(196,181,253,.26)' : 'rgba(212,175,55,.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2); ctx.fill();
      for (let ring = 0; ring < (connected ? 3 : 1); ring++) { ctx.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; const rr = r + (ring + 1) * (8 + level * 7) + Math.sin(a * (4 + ring) + phase * (ring % 2 ? -1.4 : 1.4)) * level * 7; const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = error ? 'rgba(251,113,133,.42)' : speaking ? 'rgba(250,204,21,.38)' : listening ? 'rgba(94,234,212,.38)' : thinking ? 'rgba(196,181,253,.34)' : 'rgba(212,175,55,.22)'; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.beginPath(); for (let i = 0; i <= 56; i++) { const a = i / 56 * Math.PI * 2; const rr = r * .82 + Math.sin(a * 3 + phase * 2) * level * 7 + Math.cos(a * 5 - phase * 1.5) * level * 4; const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
      const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); if (error) { grad.addColorStop(0, '#fecdd3'); grad.addColorStop(.5, '#e11d48'); grad.addColorStop(1, '#881337'); } else if (speaking) { grad.addColorStop(0, '#fff7b2'); grad.addColorStop(.45, '#f1c84b'); grad.addColorStop(1, '#7c5b13'); } else if (listening) { grad.addColorStop(0, '#c7fff4'); grad.addColorStop(.45, '#22b8a5'); grad.addColorStop(1, '#0f5f58'); } else if (thinking) { grad.addColorStop(0, '#ede9fe'); grad.addColorStop(.5, '#a78bfa'); grad.addColorStop(1, '#4c1d95'); } else { grad.addColorStop(0, '#e9d98b'); grad.addColorStop(.5, '#8b741e'); grad.addColorStop(1, '#292317'); }
      ctx.fillStyle = grad; ctx.shadowColor = error ? '#fb7185' : speaking ? '#facc15' : listening ? '#2dd4bf' : '#d4af37'; ctx.shadowBlur = connected ? 18 : 7; ctx.fill(); ctx.shadowBlur = 0;
      const shine = ctx.createRadialGradient(cx - r * .25, cy - r * .25, 1, cx - r * .25, cy - r * .25, r * .45); shine.addColorStop(0, 'rgba(255,255,255,.65)'); shine.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(cx - r * .25, cy - r * .25, r * .42, 0, Math.PI * 2); ctx.fill(); frame = requestAnimationFrame(draw);
    }; draw(); return () => cancelAnimationFrame(frame);
  }, [state, inputLevel, outputLevel, connected]);
  return <canvas ref={ref} aria-label="Jess" className="w-full h-full pointer-events-none select-none" />;
}
