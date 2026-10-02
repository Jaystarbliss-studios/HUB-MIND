import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LiveAudioClient, JessState } from '../services/liveAudioClient';
import { executeJessTool } from '../lib/jessTools';
import { resolveJessContext } from '../lib/jessContext';
import { JessOrbVisualizer } from './JessOrbVisualizer';
import { jessBackgroundTasks, JessBackgroundTask } from '../services/jessBackgroundTasks';
import { Activity } from 'lucide-react';

const POSITION_KEY = 'hubmind.jess.position.v2';
const DEFAULT_POSITION = { x: 0.92, y: 0.88 };
const DRAG_THRESHOLD = 8;
const DOUBLE_TAP_MS = 380;

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function clampViewportPosition(position: { x: number; y: number }, size: number) {
  const halfX = size / Math.max(window.innerWidth * 2, 1);
  const halfY = size / Math.max(window.innerHeight * 2, 1);
  return { x: clamp(position.x, halfX, 1 - halfX), y: clamp(position.y, halfY, 1 - halfY) };
}

function wakeTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    window.setTimeout(() => void ctx.close(), 300);
  } catch {
    /* Audio feedback optional */
  }
}

export function JessFloatingAssistant() {
  const { profile, updatePreferredName } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clientRef = useRef<LiveAudioClient | null>(null);
  const pointerRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0, lastTap: 0 });
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [connection, setConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [state, setState] = useState<JessState>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [activeBgTasks, setActiveBgTasks] = useState<JessBackgroundTask[]>([]);

  useEffect(() => {
    const unsub = jessBackgroundTasks.subscribe(tasks => {
      setActiveBgTasks(tasks.filter(t => t.status === 'in_progress'));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || '');
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) setPosition(clampViewportPosition({ x: saved.x, y: saved.y }, 64));
    } catch {
      /* use default */
    }
  }, []);

  useEffect(() => () => { void clientRef.current?.disconnect(); clientRef.current = null; }, []);

  const stop = useCallback(async () => {
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setConnection('disconnected');
    setState('idle');
    setInputLevel(0);
    setOutputLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (clientRef.current || !profile) return;
    wakeTone();
    const client = new LiveAudioClient({
      onStatusChange: setConnection,
      onJessStateChange: setState,
      onJessTranscript: () => {},
      onTurnComplete: () => {},
      onError: error => console.error('[Jess]', error),
      onAudioLevel: (input, output) => {
        setInputLevel(input);
        setOutputLevel(output);
      },
      onFunctionCall: async fc => {
        const context = resolveJessContext(location.pathname);
        const result = await executeJessTool(fc.name, fc.args, profile, name => void updatePreferredName(name), context);
        if (result.actionPayload?.type === 'navigate' && result.actionPayload.path) {
          navigate(result.actionPayload.path);
        }
        client.sendFunctionResponse({ name: fc.name, id: fc.id, response: result.result });

        if (fc.name === 'end_session' || result.actionPayload?.type === 'sleep') {
          // Allow speech synthesis to complete if speaking, then cleanly deactivate
          window.setTimeout(() => {
            void stop();
          }, 1800);
        }
      },
      onUserTranscript: text => {
        const lower = (text || '').toLowerCase().trim();
        if (
          lower === 'end this session' ||
          lower.includes('end this session') ||
          lower === 'go to sleep' ||
          lower === 'sleep jess' ||
          lower === 'put ai on sleep' ||
          lower === 'deactivate assistant'
        ) {
          window.setTimeout(() => {
            void stop();
          }, 1500);
        }
      },
    });
    clientRef.current = client;
    try {
      const firstName = profile.preferredName || profile.displayName || profile.name?.split(' ')[0] || 'there';
      const context = resolveJessContext(location.pathname);
      await client.connect({ ...context, userName: firstName, userRole: profile.role });
      window.setTimeout(() => {
        client.sendText(`Greet ${firstName} warmly and briefly ask what you can assist with today. Do NOT say "I am Jess" or introduce yourself by name unless the user asks for your name or identity.`);
      }, 450);
    } catch {
      await stop();
    }
  }, [location.pathname, navigate, profile, stop, updatePreferredName]);

  const activate = useCallback(() => {
    if (connection === 'connected' || connection === 'connecting') void stop();
    else void start();
  }, [connection, start, stop]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'touch' && e.button !== 0) return;
    const p = pointerRef.current;
    p.dragging = true;
    p.moved = false;
    p.startX = e.clientX;
    p.startY = e.clientY;
    p.originX = position.x;
    p.originY = position.y;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pointerRef.current;
    if (!p.dragging) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) p.moved = true;
    if (!p.moved) return;
    const next = clampViewportPosition(
      { x: p.originX + dx / Math.max(window.innerWidth, 1), y: p.originY + dy / Math.max(window.innerHeight, 1) },
      active ? 76 : 64
    );
    setPosition(next);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(next));
    } catch {
      /* cache is optional */
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pointerRef.current;
    p.dragging = false;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    if (p.moved) return;
    const now = Date.now();
    if (now - p.lastTap <= DOUBLE_TAP_MS) {
      p.lastTap = 0;
      activate();
    } else {
      p.lastTap = now;
    }
  };

  const onPointerCancel = () => {
    pointerRef.current.dragging = false;
    pointerRef.current.moved = false;
  };

  if (!profile) return null;
  const active = connection === 'connected' || connection === 'connecting';
  const size = active ? 76 : 64;
  const renderedPosition = typeof window !== 'undefined' ? clampViewportPosition(position, size) : position;

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerCancel}
        aria-label="Jess Assistant (double-tap or double-click to toggle, drag to reposition)"
        style={{
          position: 'fixed',
          left: `${renderedPosition.x * 100}%`,
          top: `${renderedPosition.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: `${size}px`,
          height: `${size}px`,
          touchAction: 'none',
          zIndex: 9999,
        }}
        className={`group cursor-pointer rounded-full p-0 border-0 outline-none select-none touch-none transition-transform duration-150 ${
          active ? 'scale-105 shadow-2xl' : 'hover:scale-105 active:scale-95'
        }`}
      >
        <JessOrbVisualizer state={state} inputLevel={inputLevel} outputLevel={outputLevel} connected={active} />
        {activeBgTasks.length > 0 && (
          <div className="absolute -top-1.5 -right-1.5 bg-accent text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5 border border-slate-900 animate-pulse">
            <Activity className="w-2.5 h-2.5" />
            <span>{activeBgTasks[0].progress}%</span>
          </div>
        )}
      </button>
    </>
  );
}
