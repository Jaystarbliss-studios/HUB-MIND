import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LiveAudioClient, JessState } from '../services/liveAudioClient';
import { executeJessTool } from '../lib/jessTools';
import { resolveJessContext } from '../lib/jessContext';
import { JessOrbVisualizer } from './JessOrbVisualizer';

const POSITION_KEY = 'hubmind.jess.position.v2';
const DEFAULT_POSITION = { x: 0.92, y: 0.88 };
const DRAG_THRESHOLD = 8;
const DOUBLE_TAP_MS = 380;

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function clampViewportPosition(position: { x:number; y:number }, size:number) {
  const halfX = size / Math.max(window.innerWidth * 2, 1);
  const halfY = size / Math.max(window.innerHeight * 2, 1);
  return { x: clamp(position.x, halfX, 1 - halfX), y: clamp(position.y, halfY, 1 - halfY) };
}

function wakeTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx(); const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(620, now); osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.2); window.setTimeout(() => void ctx.close(), 300);
  } catch { /* Audio feedback is optional. */ }
}

export function JessFloatingAssistant() {
  const { profile, updatePreferredName } = useAuth();
  const location = useLocation(); const navigate = useNavigate();
  const clientRef = useRef<LiveAudioClient | null>(null);
  const pointerRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0, lastTap: 0 });
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [connection, setConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [state, setState] = useState<JessState>('idle');
  const [inputLevel, setInputLevel] = useState(0); const [outputLevel, setOutputLevel] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || '');
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) setPosition(clampViewportPosition({ x: saved.x, y: saved.y }, 64));
    } catch { /* use default */ }
  }, []);

  useEffect(() => () => { void clientRef.current?.disconnect(); clientRef.current = null; }, []);

  const stop = useCallback(async () => {
    await clientRef.current?.disconnect(); clientRef.current = null;
    setConnection('disconnected'); setState('idle'); setInputLevel(0); setOutputLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (clientRef.current || !profile) return;
    wakeTone();
    const client = new LiveAudioClient({
      onStatusChange: setConnection,
      onJessStateChange: setState,
      onUserTranscript: () => {},
      onJessTranscript: () => {},
      onTurnComplete: () => {},
      onError: error => console.error('[Jess]', error),
      onAudioLevel: (input, output) => { setInputLevel(input); setOutputLevel(output); },
      onFunctionCall: async fc => {
        const context = resolveJessContext(location.pathname);
        const result = await executeJessTool(fc.name, fc.args, profile, name => void updatePreferredName(name), context);
        if (result.actionPayload?.type === 'navigate' && result.actionPayload.path) navigate(result.actionPayload.path);
        client.sendFunctionResponse({ name: fc.name, id: fc.id, response: result.result });
      },
    });
    clientRef.current = client;
    try {
      const firstName = profile.preferredName || profile.name?.split(' ')[0] || 'there';
      const context = resolveJessContext(location.pathname);
      await client.connect({ ...context, userName: firstName, userRole: profile.role });
      window.setTimeout(() => client.sendText(`Begin naturally. Greet ${firstName} by name, say you are Jess, and ask what they would like to do. Keep it short.`), 450);
    } catch { await stop(); }
  }, [location.pathname, navigate, profile, stop, updatePreferredName]);

  const activate = useCallback(() => {
    if (connection === 'connected' || connection === 'connecting') void stop(); else void start();
  }, [connection, start, stop]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'touch' && e.button !== 0) return;
    const p = pointerRef.current;
    p.dragging = true; p.moved = false; p.startX = e.clientX; p.startY = e.clientY; p.originX = position.x; p.originY = position.y;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pointerRef.current; if (!p.dragging) return;
    const dx = e.clientX - p.startX; const dy = e.clientY - p.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) p.moved = true;
    if (!p.moved) return;
    const next = clampViewportPosition({ x: p.originX + dx / Math.max(window.innerWidth, 1), y: p.originY + dy / Math.max(window.innerHeight, 1) }, active ? 76 : 64);
    setPosition(next); try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* cache is optional */ }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pointerRef.current; p.dragging = false;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
    if (p.moved) return;
    const now = Date.now();
    if (now - p.lastTap <= DOUBLE_TAP_MS) { p.lastTap = 0; activate(); } else p.lastTap = now;
  };

  const onPointerCancel = () => { pointerRef.current.dragging = false; pointerRef.current.moved = false; };

  if (!profile) return null;
  const active = connection === 'connected' || connection === 'connecting';
  const size = active ? 76 : 64;

  return (
    <button
      type="button"
      aria-label={active ? 'Double tap to end Jess live session' : 'Double tap to talk to Jess'}
      title="Double tap to talk to Jess"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      className="fixed z-[9999] touch-none select-none rounded-full outline-none transition-[width,height,opacity,filter] duration-300"
      style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%`, width: size, height: size, transform: 'translate(-50%,-50%)', background: 'transparent', border: 0, padding: 0, opacity: active ? 1 : .76, cursor: pointerRef.current.dragging ? 'grabbing' : 'grab' }}
    >
      <JessOrbVisualizer state={state} inputLevel={inputLevel} outputLevel={outputLevel} connected={active} />
    </button>
  );
}
