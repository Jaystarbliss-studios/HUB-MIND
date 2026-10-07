import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { LiveAudioClient, JessState } from '../services/liveAudioClient';
import { executeJessTool } from '../lib/jessTools';
import { resolveJessContext } from '../lib/jessContext';
import { JessOrbVisualizer } from './JessOrbVisualizer';
import { jessBackgroundTasks, JessBackgroundTask } from '../services/jessBackgroundTasks';
import { autoExtractMemory } from '../services/memoryService';
import { trackAndPersistSentiment } from '../services/sentimentService';
import { scanCurrentPageContext, ContextActionSuggestion } from '../services/contextScannerService';
import { startJessWorkspaceCache } from '../services/jessWorkspaceCache';
import { hydrateGoogleCalendarConnection, isGoogleCalendarConnected, refreshGoogleCalendarEvents } from '../lib/googleCalendar';
import { JessPcWakeListener, isJessPcWakeSupported } from '../services/jessWakeListener';
import { 
  Activity, 
  Lightbulb, 
  FileText, 
  CheckSquare, 
  Calendar, 
  Mail, 
  Share2, 
  Users, 
  ChevronRight,
  X,
  Brain,
  Trash2,
  AlertTriangle
} from 'lucide-react';

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



function getJessScrollTarget(): HTMLElement | Window {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const candidates: HTMLElement[] = [];
  let node: HTMLElement | null = active;
  while (node && node !== document.body) {
    if (node.scrollHeight > node.clientHeight + 20 && ['auto','scroll'].includes(getComputedStyle(node).overflowY)) candidates.push(node);
    node = node.parentElement;
  }
  const main = document.querySelector<HTMLElement>('[role="main"],main,.overflow-y-auto,.overflow-auto');
  if (main && main.scrollHeight > main.clientHeight + 20) candidates.push(main);
  const mainTarget = document.querySelector<HTMLElement>('[role="main"],main');
  if (mainTarget && mainTarget.scrollHeight > mainTarget.clientHeight + 20) return mainTarget;
  return candidates[0] || window;
}

function findJessVisibleElement(target?: string, selector?: string): HTMLElement | null {
  if (selector) {
    try {
      const found = document.querySelector(selector);
      if (found instanceof HTMLElement) return found;
    } catch {}
  }
  const needle = String(target || '').trim().toLowerCase();
  if (!needle) return null;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button,a,[role="button"],input,textarea,[contenteditable="true"],[title],[aria-label],[data-jess-click-target],p,span,li,h1,h2,h3,h4,h5,h6'));
  return candidates
    .map(el => ({ el, text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || (el as HTMLInputElement).placeholder || '').trim().toLowerCase() }))
    .filter(x => x.text && x.text.length <= 240 && (x.text === needle || x.text.includes(needle) || needle.includes(x.text)))
    .sort((a,b) => Math.abs(a.text.length - needle.length) - Math.abs(b.text.length - needle.length))[0]?.el || null;
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

interface CurrentSpeechState {
  text: string;
  speaker: 'user' | 'jess';
  visible: boolean;
}

export function JessFloatingAssistant() {
  const { user, profile, updatePreferredName } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clientRef = useRef<LiveAudioClient | null>(null);
  const sessionEndingRef = useRef(false);
  const screenControlRef = useRef<{ timer: number | null; running: boolean; speed: number; direction: number }>({ timer: null, running: false, speed: 3, direction: 1 });
  const backgroundHydratedUserRef = useRef<string | null>(null);
  const pointerRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0, lastTap: 0, tapTimer: null as number | null });
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [connection, setConnection] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [state, setState] = useState<JessState>('idle');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [activeBgTasks, setActiveBgTasks] = useState<JessBackgroundTask[]>([]);

  // 70% transparent transient Gemini Live style subtitle overlay
  const [speechState, setSpeechState] = useState<CurrentSpeechState>({
    text: '',
    speaker: 'user',
    visible: false,
  });
  const [recentMemorySaved, setRecentMemorySaved] = useState<string | null>(null);

  // Context-aware Page/Document Scanner Menu
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextActions, setContextActions] = useState<ContextActionSuggestion[]>([]);

  // Assistant Deletion Confirmation Modal State
  const [pendingDelete, setPendingDelete] = useState<{
    itemType: string;
    itemId: string;
    itemTitle: string;
    collectionName: string;
    message?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const jessSpeechAccumulatorRef = useRef<string>('');
  const fadeTimerRef = useRef<number | null>(null);

  // Rescan context when route changes
  useEffect(() => {
    const actions = scanCurrentPageContext(location.pathname);
    setContextActions(actions);
  }, [location.pathname]);

  useEffect(() => {
    if (!profile?.id) {
      backgroundHydratedUserRef.current = null;
      setActiveBgTasks([]);
      return;
    }
    const unsub = jessBackgroundTasks.subscribe(tasks => {
      setActiveBgTasks(tasks.filter(t => t.userId === profile.id && t.status === 'in_progress'));
    });
    return () => { unsub(); };
  }, [profile?.id]);

  // Keep a warm, user-scoped local index of the workspace. Firestore's persistent
  // cache gives this listener immediate local data, while server updates arrive
  // continuously in the background.
  useEffect(() => {
    if (!profile) return;
    const stopCache = startJessWorkspaceCache(profile);
    let cancelled = false;

    void (async () => {
      const calendarConnected = await hydrateGoogleCalendarConnection();
      if (!cancelled && (calendarConnected || isGoogleCalendarConnected())) {
        void refreshGoogleCalendarEvents().catch(() => {});
      }
    })();

    // Hydrate/resume persisted jobs once per signed-in user. Navigation must not
    // restart the same background operation or duplicate its executor.
    if (backgroundHydratedUserRef.current !== profile.id) {
      backgroundHydratedUserRef.current = profile.id;
      void jessBackgroundTasks.resumePersistedTasks(profile.id, async (_task, step) => {
        const result = await executeJessTool(String(step.tool), step.args || {}, profile, name => void updatePreferredName(name), resolveJessContext(location.pathname));
        if (!result.result?.success) throw new Error(result.result?.error || 'Background step failed.');
      });
    }

    return () => {
      cancelled = true;
      stopCache();
    };
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || '');
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) setPosition(clampViewportPosition({ x: saved.x, y: saved.y }, 64));
    } catch {
      /* use default */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      const control = screenControlRef.current;
      if (pointerRef.current.tapTimer !== null) window.clearTimeout(pointerRef.current.tapTimer);
      pointerRef.current.tapTimer = null;
      if (control.timer !== null) window.clearInterval(control.timer);
      control.timer = null;
      control.running = false;
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  const scheduleFade = useCallback((delayMs = 5000) => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setSpeechState(prev => ({ ...prev, visible: false }));
    }, delayMs);
  }, []);

  const stop = useCallback(async () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setConnection('disconnected');
    setState('idle');
    setInputLevel(0);
    setOutputLevel(0);
    setSpeechState({ text: '', speaker: 'user', visible: false });
    setShowContextMenu(false);
  }, []);

  const start = useCallback(async (initialPrompt?: string) => {
    if (!profile) return;

    // A previous Live session can remain referenced after a transient network or
    // provider error. Reclaim it so the next activation can always create a fresh
    // session instead of silently returning.
    if (clientRef.current) {
      if (connection === 'connected' || connection === 'connecting') return;
      try { await clientRef.current.disconnect(false); } catch {}
      clientRef.current = null;
    }
    sessionEndingRef.current = false;
    wakeTone();
    jessSpeechAccumulatorRef.current = '';

    const client = new LiveAudioClient({
      onStatusChange: setConnection,
      onJessStateChange: setState,
      onJessTranscript: (text) => {
        if (!text) return;
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        const next = jessSpeechAccumulatorRef.current ? `${jessSpeechAccumulatorRef.current} ${text}` : text;
        jessSpeechAccumulatorRef.current = next;
        setSpeechState({
          text: next,
          speaker: 'jess',
          visible: true,
        });
      },
      onTurnComplete: () => {
        jessSpeechAccumulatorRef.current = '';
        scheduleFade(5000);
      },
      onError: error => {
        console.warn('[Jess]', error);
        setSpeechState({
          text: typeof error === 'string' && error.includes('Permission')
            ? 'Microphone permission was denied. You can interact with Jess using actions and suggestions.'
            : (typeof error === 'string' ? error : 'Unable to connect to assistant.'),
          speaker: 'jess',
          visible: true,
        });
        scheduleFade(6000);
      },
      onAudioLevel: (input, output) => {
        setInputLevel(input);
        setOutputLevel(output);
      },
      onFunctionCall: async fc => {
        const context = resolveJessContext(location.pathname);
        let toolArgs = fc.args;
        if (typeof toolArgs === 'string') {
          try { toolArgs = JSON.parse(toolArgs); } catch { toolArgs = {}; }
        }
        let result: any;
        try {
          result = await executeJessTool(fc.name, toolArgs || {}, profile, name => void updatePreferredName(name), context);
        } catch (error: any) {
          // A tool failure must become a tool response, not an unhandled promise.
          // Returning the failure to Gemini lets Jess recover conversationally and
          // keeps the Live session usable for the next command.
          result = {
            result: {
              success: false,
              error: error?.message || 'The requested Hub-Mind action failed unexpectedly.',
            },
          };
        }

        // Screen-control actions are executed by the signed-in browser, not merely
        // acknowledged. This gives Jess direct, visible control of the Hub-Mind UI.
        if (result.actionPayload?.type === 'screen_control') {
          const p = result.actionPayload;
          const control = screenControlRef.current;
          const stopScroll = () => {
            if (control.timer !== null) window.clearInterval(control.timer);
            control.timer = null;
            control.running = false;
          };
          if (p.action === 'stop' || p.mode === 'stop') {
            stopScroll();
            result.result.message = 'Stopped screen control.';
          } else if (p.action === 'scroll') {
            if (p.mode === 'top') {
              stopScroll();
              const target = getJessScrollTarget();
              if (target === window) window.scrollTo({ top: 0, behavior: 'smooth' }); else target.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (p.mode === 'bottom') {
              stopScroll();
              const target = getJessScrollTarget();
              if (target === window) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); else target.scrollTo({ top: (target as HTMLElement).scrollHeight, behavior: 'smooth' });
            } else if (p.mode === 'by') {
              stopScroll();
              const direction = p.direction === 'up' ? -1 : 1;
              const amount = Math.max(50, Math.min(3000, Number(p.amount) || window.innerHeight * 0.75));
              const target = getJessScrollTarget();
              if (target === window) window.scrollBy({ top: direction * amount, behavior: 'smooth' }); else target.scrollBy({ top: direction * amount, behavior: 'smooth' });
            } else {
              const speeds: Record<string, number> = { slow: 1.2, normal: 3, fast: 7, very_fast: 14 };
              control.speed = speeds[p.speed] || 3;
              stopScroll();
              control.running = true;
              control.timer = window.setInterval(() => {
                if (!control.running) return;
                const direction = p.direction === 'up' ? -1 : 1;
                const target = getJessScrollTarget();
                if (target === window) window.scrollBy(0, direction * control.speed); else target.scrollBy({ top: direction * control.speed });
              }, 16);
            }
            result.result.message = 'Screen scrolling command completed on the visible Hub-Mind screen.';
          } else if (p.action === 'click') {
            const el = findJessVisibleElement(p.target, p.selector);
            if (!el) {
              result.result = { success: false, error: 'I could not find a visible screen element matching that target.' };
            } else {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              window.setTimeout(() => el.click(), 120);
              result.result.message = 'Clicked the visible screen element: ' + (p.target || p.selector || el.innerText || el.getAttribute('aria-label') || 'target');
            }
          } else if (p.action === 'type') {
            const el = findJessVisibleElement(p.target, p.selector);
            if (!el) {
              result.result = { success: false, error: 'I could not find a visible input or editor field matching that target.' };
            } else {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.focus();
              if (p.clearFirst) {
                if ('value' in el) (el as HTMLInputElement).value = '';
                else if (el.isContentEditable) el.textContent = '';
              }
              if ('value' in el) {
                const input = el as HTMLInputElement;
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                setter?.call(input, String(p.text || ''));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              } else if (el.isContentEditable) {
                el.textContent = String(p.text || '');
                el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(p.text || '') }));
              }
              result.result.message = 'Typed into the visible screen field.';
            }
          }
        }

        client.sendFunctionResponse({ name: fc.name, id: fc.id, response: result.result });
        if (result.actionPayload?.type === 'navigate' && result.actionPayload.path) {
          navigate(result.actionPayload.path);
        }

        if (result.actionPayload?.type === 'confirm_delete') {
          setPendingDelete({
            itemType: result.actionPayload.itemType,
            itemId: result.actionPayload.itemId,
            itemTitle: result.actionPayload.itemTitle,
            collectionName: result.actionPayload.collectionName,
            message: result.actionPayload.message,
          });
        }

        if (fc.name === 'save_user_memory' && result.result?.success) {
          setRecentMemorySaved(result.result.content || 'Preference remembered');
          setTimeout(() => setRecentMemorySaved(null), 3500);
        }

        if (fc.name === 'end_session' || result.actionPayload?.type === 'sleep') {
          sessionEndingRef.current = true;
          window.setTimeout(() => { void stop(); }, 100);
        }
      },
      onUserTranscript: (text) => {
        if (sessionEndingRef.current || !text) return;
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        jessSpeechAccumulatorRef.current = '';
        setSpeechState({
          text,
          speaker: 'user',
          visible: true,
        });

        // Sentiment Analysis & Emotional State Tracking
        if (profile?.id) {
          trackAndPersistSentiment(profile.id, text).catch(() => {});
        }

        // Auto-extract memory from user statements if explicit preference mentioned
        if (profile?.id) {
          autoExtractMemory(profile.id, text).then(saved => {
            if (saved) {
              setRecentMemorySaved(saved.content);
              setTimeout(() => setRecentMemorySaved(null), 3500);
            }
          }).catch(() => {});
        }

        const lower = text.toLowerCase().trim();
        if (
          lower === 'end this session' ||
          lower.includes('end this session') ||
          lower.includes('end session jess') ||
          lower.includes('end jess session') ||
          lower.includes('stop jess') ||
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
      const fullName = profile.preferredName || profile.displayName || profile.name || user?.displayName || (profile.email ? profile.email.split('@')[0] : 'User');
      const firstName = profile.preferredName || profile.displayName?.split(' ')[0] || profile.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || fullName;
      const context = resolveJessContext(location.pathname);
      await client.connect({ 
        ...context, 
        userId: profile.id, 
        userName: fullName, 
        userRole: profile.role 
      });
      // Manual activation should enter a clean listening state immediately.
      // Do not make Jess speak a startup greeting: it adds latency and can occupy
      // the Live turn just as the user is trying to speak. Passive wake commands
      // still get delivered immediately once the Live session is ready.
      if (initialPrompt) {
        client.sendText(initialPrompt);
      }
    } catch {
      await stop();
    }
  }, [connection, location.pathname, navigate, profile, stop, updatePreferredName, scheduleFade]);

  const activate = useCallback(() => {
    if (connection === 'connected' || connection === 'connecting') void stop();
    else void start();
  }, [connection, start, stop]);


  // PC-only passive voice wake. The passive listener is deliberately separate
  // from Gemini Live so the full microphone session is not held open while Jess
  // is asleep. Phones/tablets remain tap-only.
  useEffect(() => {
    if (!profile || connection === 'connected' || connection === 'connecting') return;
    if (!isJessPcWakeSupported()) return;

    const wakeListener = new JessPcWakeListener({
      onWake: (command) => {
        // Give the user the same subtle acknowledgement as manual activation.
        wakeTone();
        void start(command || undefined);
      },
    });

    wakeListener.start();
    return () => wakeListener.stop();
  }, [profile?.id, connection, start]);

  const handleConfirmDeletion = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, pendingDelete.collectionName, pendingDelete.itemId));
      const title = pendingDelete.itemTitle;
      const type = pendingDelete.itemType;
      setPendingDelete(null);
      setRecentMemorySaved(`Deleted ${type} "${title}"`);
      setTimeout(() => setRecentMemorySaved(null), 3500);
      if (clientRef.current) {
        clientRef.current.sendText(`I have confirmed and permanently deleted the ${type} "${title}".`);
      }
    } catch (err: any) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeletion = () => {
    if (!pendingDelete) return;
    const type = pendingDelete.itemType;
    const title = pendingDelete.itemTitle;
    setPendingDelete(null);
    if (clientRef.current) {
      clientRef.current.sendText(`I cancelled the deletion request for ${type} "${title}". Keep it safe.`);
    }
  };

  const handleExecuteContextAction = (action: ContextActionSuggestion) => {
    setShowContextMenu(false);
    if (connection === 'connected' && clientRef.current) {
      clientRef.current.sendText(action.prompt);
    } else {
      start(action.prompt);
    }
  };

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
    // Once Jess is active, a single tap is an explicit microphone mute/unmute.
    // When Jess is idle, the established double-tap gesture still activates her.
    if (connection === 'error') {
      p.lastTap = 0;
      if (p.tapTimer !== null) window.clearTimeout(p.tapTimer);
      p.tapTimer = null;
      activate();
      return;
    }

    // Gesture contract:
    // - Idle: double-tap activates Jess.
    // - Active: single tap mutes/unmutes; double-tap deactivates Jess.
    // Delay the active single-tap action briefly so the second tap can claim the
    // gesture as a deactivation instead of causing two mute toggles.
    if (active) {
      if (now - p.lastTap <= DOUBLE_TAP_MS) {
        if (p.tapTimer !== null) window.clearTimeout(p.tapTimer);
        p.tapTimer = null;
        p.lastTap = 0;
        void stop();
      } else {
        p.lastTap = now;
        if (p.tapTimer !== null) window.clearTimeout(p.tapTimer);
        p.tapTimer = window.setTimeout(() => {
          p.tapTimer = null;
          p.lastTap = 0;
          clientRef.current?.toggleMute();
        }, DOUBLE_TAP_MS);
      }
      return;
    }

    if (now - p.lastTap <= DOUBLE_TAP_MS) {
      if (p.tapTimer !== null) window.clearTimeout(p.tapTimer);
      p.tapTimer = null;
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

  const isRightHalf = renderedPosition.x > 0.5;
  const isBottomHalf = renderedPosition.y > 0.5;

  const renderIcon = (name: string) => {
    switch (name) {
      case 'FileText': return <FileText className="w-4 h-4 text-teal-400 shrink-0" />;
      case 'CheckSquare': return <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />;
      case 'Calendar': return <Calendar className="w-4 h-4 text-teal-300 shrink-0" />;
      case 'Mail': return <Mail className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'Share2': return <Share2 className="w-4 h-4 text-teal-400 shrink-0" />;
      case 'Users': return <Users className="w-4 h-4 text-cyan-300 shrink-0" />;
      case 'Activity': return <Activity className="w-4 h-4 text-teal-400 shrink-0" />;
      default: return <Lightbulb className="w-4 h-4 text-teal-400 shrink-0" />;
    }
  };

  return (
    <>
      {/* 70% Transparent Floating Subtitle Box (Gemini Live Style) */}
      <div
        aria-live="polite"
        className={`fixed z-[9998] pointer-events-none transition-all duration-300 ease-out flex flex-col items-center justify-end ${
          speechState.visible && speechState.text
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}
        style={{
          left: '50%',
          bottom: '100px',
          transform: 'translateX(-50%)',
          width: 'min(92vw, 440px)',
        }}
      >
        {/* Subtle Memory Saved Pill (Transient) */}
        {recentMemorySaved && (
          <div className="mb-2 px-3 py-1 bg-slate-950/85 backdrop-blur-md text-teal-300 text-xs font-semibold rounded-full shadow-lg border border-teal-500/30 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            <Brain className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate max-w-[340px]">Remembered: {recentMemorySaved}</span>
          </div>
        )}

        {/* Minimalist 70% Transparent Subtitle Box matching Gemini Live & Hub-Mind theme */}
        {speechState.text && (
          <div className="w-full bg-slate-950/75 backdrop-blur-md rounded-2xl px-5 py-3.5 shadow-2xl border border-teal-500/20 text-slate-100 text-sm sm:text-base font-normal leading-relaxed text-left select-none animate-in fade-in duration-200">
            {speechState.text}
          </div>
        )}
      </div>

      {/* Context-Aware Quick Menu Floating Card (Hub-Mind Aquamarine Palette) */}
      {showContextMenu && (
        <div
          style={{
            position: 'fixed',
            left: isRightHalf 
              ? `calc(${renderedPosition.x * 100}% - ${size / 2 + 16}px)` 
              : `calc(${renderedPosition.x * 100}% + ${size / 2 + 16}px)`,
            top: isBottomHalf 
              ? `calc(${renderedPosition.y * 100}% - 270px)` 
              : `calc(${renderedPosition.y * 100}% + ${size / 2 + 16}px)`,
            transform: isRightHalf ? 'translateX(-100%)' : 'none',
            zIndex: 9998,
          }}
          className="w-[290px] bg-slate-950/95 backdrop-blur-2xl border border-teal-500/30 rounded-3xl shadow-2xl shadow-teal-950/50 p-3 text-slate-100 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Menu Header */}
          <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-teal-500/20">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Lightbulb className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-teal-300 tracking-wide">Suggested Actions</h4>
                <p className="text-[10px] text-slate-400 leading-none">Relevant to active screen</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowContextMenu(false)}
              className="p-1 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action List */}
          <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-0.5">
            {contextActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleExecuteContextAction(action)}
                className="w-full text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-teal-500/10 active:bg-teal-500/15 border border-slate-800/80 hover:border-teal-500/40 transition-all flex items-start gap-2.5 group cursor-pointer"
              >
                <div className="mt-0.5 p-1.5 bg-slate-950 rounded-xl border border-slate-800 group-hover:border-teal-500/30 transition-colors shrink-0">
                  {renderIcon(action.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-100 group-hover:text-teal-300 truncate flex items-center justify-between transition-colors">
                    <span>{action.title}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-teal-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="text-[11px] text-slate-400 truncate leading-snug">{action.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Planetary Orbiting Quick Suggestions Satellite Button (Pure Lightbulb Icon) */}
      <div
        style={{
          position: 'fixed',
          left: `${renderedPosition.x * 100}%`,
          top: `${renderedPosition.y * 100}%`,
          width: '0px',
          height: '0px',
          transform: `translate(${isRightHalf ? '-56px' : '24px'}, ${isBottomHalf ? '-56px' : '24px'})`,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
        className="flex items-center justify-center"
      >
        <button
          type="button"
          onClick={() => setShowContextMenu(v => !v)}
          className={`pointer-events-auto group w-[32px] h-[32px] min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] aspect-square rounded-full p-0 flex items-center justify-center shrink-0 overflow-hidden box-border bg-slate-950/95 hover:bg-slate-900 border border-teal-400/60 hover:border-teal-300 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.35)] backdrop-blur-md ring-1 ring-teal-400/30 transition-all duration-200 cursor-pointer ${
            showContextMenu ? 'bg-slate-900 ring-2 ring-teal-300 border-teal-300 scale-110 shadow-[0_0_16px_rgba(45,212,191,0.5)]' : 'animate-jess-orbit'
          }`}
          title="Quick Suggestions"
        >
          <Lightbulb className="w-4 h-4 text-teal-300 group-hover:scale-110 transition-transform shrink-0" />
        </button>
      </div>

      {/* Floating Assistant Orb Button */}
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

      {/* Delete Confirmation Modal (User has the final say) */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl shadow-rose-950/40 text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="delete-dialog-title" className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Confirm Assistant Deletion Request</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Jess requested to delete the following item from your dashboard. You have the final say.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400/90">
                {pendingDelete.itemType}
              </div>
              <div className="text-sm font-semibold text-slate-100 truncate">
                "{pendingDelete.itemTitle}"
              </div>
              <div className="text-[11px] text-slate-400">
                ID: <span className="font-mono text-slate-400">{pendingDelete.itemId}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              This action cannot be undone. Are you sure you want to permanently delete this {pendingDelete.itemType}?
            </p>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={handleCancelDeletion}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                Keep Item (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletion}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-950/50 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : `Delete ${pendingDelete.itemType}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
