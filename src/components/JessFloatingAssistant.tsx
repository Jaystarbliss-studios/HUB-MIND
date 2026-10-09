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
import { JessPcWakeListener, isJessPcWakeSupported, isJessInstalledApp } from '../services/jessWakeListener';
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



function isJessScrollable(el: HTMLElement, axis: 'x' | 'y'): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  const extent = axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
  return extent > 12 && (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay');
}

function getJessScrollTarget(axis: 'x' | 'y' = 'y', requestedTarget = ''): HTMLElement | Window {
  const needle = requestedTarget.toLowerCase().trim();
  const isVisible = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  };
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('main, [role="main"], aside, [role="complementary"], section, article, [class*="overflow-"], [data-jess-scrollable], [role="dialog"]'))
    .filter(el => isVisible(el) && isJessScrollable(el, axis) && !el.closest('[data-jess-orb], [data-jess-satellite]'))
    .map(el => {
      const text = [el.getAttribute('aria-label'), el.getAttribute('title'), el.id, typeof el.className === 'string' ? el.className : '', el.innerText?.slice(0, 160)]
        .filter(Boolean).join(' ').toLowerCase();
      const rect = el.getBoundingClientRect();
      let score = Math.min(100, (axis === 'x' ? el.scrollWidth / Math.max(el.clientWidth, 1) : el.scrollHeight / Math.max(el.clientHeight, 1)) * 10);
      if (el.matches('main, [role="main"]')) score += 18;
      if (el.matches('aside, [role="complementary"]')) score += 8;
      if (needle && text.includes(needle)) score += 100;
      return { el, score, rect };
    });
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (active) {
    let node: HTMLElement | null = active;
    while (node && node !== document.body) {
      if (isJessScrollable(node, axis) && isVisible(node) && !node.closest('[data-jess-orb], [data-jess-satellite]')) return node;
      node = node.parentElement;
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0]) return candidates[0].el;
  const root = document.scrollingElement as HTMLElement | null;
  if (root) {
    const extent = axis === 'x' ? root.scrollWidth - window.innerWidth : root.scrollHeight - window.innerHeight;
    if (extent > 12) return window;
  }
  return window;
}

function getJessHorizontalScrollTarget(requestedTarget = ''): HTMLElement | Window {
  return getJessScrollTarget('x', requestedTarget);
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
  const screenControlRef = useRef<{ timer: number | null; running: boolean; speed: number; direction: number; axis: 'x' | 'y' }>({ timer: null, running: false, speed: 3, direction: 1, axis: 'y' });
  const screenShareRef = useRef<{ stream: MediaStream | null; timer: number | null; video: HTMLVideoElement | null; nativePlugin: any; nativeListener: any }>({ stream: null, timer: null, video: null, nativePlugin: null, nativeListener: null });
  const [screenSharingActive, setScreenSharingActive] = useState(false);
  const backgroundHydratedUserRef = useRef<string | null>(null);
  const pointerRef = useRef({ dragging: false, moved: false, longPressed: false, holdTimer: null as number | null, startX: 0, startY: 0, originX: 0, originY: 0, lastTap: 0, tapTimer: null as number | null });
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
  const [showOrbDismiss, setShowOrbDismiss] = useState(false);
  const [screenSharePrompt, setScreenSharePrompt] = useState(false);
  const [orbDismissed, setOrbDismissed] = useState(false);
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

  const stopScreenSharing = useCallback(async (announce = false) => {
    const share = screenShareRef.current;
    if (share.timer !== null) window.clearInterval(share.timer);
    share.timer = null;
    if (share.stream) share.stream.getTracks().forEach(track => track.stop());
    share.stream = null;
    if (share.video) { share.video.pause(); share.video.srcObject = null; }
    share.video = null;
    if (share.nativeListener?.remove) await share.nativeListener.remove().catch(() => undefined);
    share.nativeListener = null;
    if (share.nativePlugin?.stopSharing) await share.nativePlugin.stopSharing().catch(() => undefined);
    share.nativePlugin = null;
    setScreenSharingActive(false);
    if (announce) setSpeechState({ text: 'Screen sharing has stopped.', speaker: 'jess', visible: true });
  }, []);

  const beginDesktopScreenShare = useCallback(async () => {
    setScreenSharePrompt(false);
    const share = screenShareRef.current;
    try {
      if (!isJessInstalledApp() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
        throw new Error('This screen-sharing option is only available in the installed desktop app. Mobile cross-app sharing requires the native app.');
      }
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen capture is not supported by this installed app environment.');
      if (share.stream) share.stream.getTracks().forEach(track => track.stop());
      if (share.timer !== null) window.clearInterval(share.timer);
      share.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
      share.video = document.createElement('video');
      share.video.muted = true;
      share.video.playsInline = true;
      share.video.srcObject = share.stream;
      await share.video.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 960;
      canvas.height = 540;
      const sendFrame = () => {
        if (!share.video || !ctx || share.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        ctx.drawImage(share.video, 0, 0, canvas.width, canvas.height);
        clientRef.current?.sendScreenFrame(canvas.toDataURL('image/jpeg', 0.62));
      };
      sendFrame();
      share.timer = window.setInterval(sendFrame, 1200);
      setScreenSharingActive(true);
      clientRef.current?.sendText('SCREEN SHARE STATUS: Screen sharing is now active. You may receive periodic screen frames. Only describe what is visible in received frames; frames are snapshots, not continuous video.');
      share.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        void stopScreenSharing(false);
        setSpeechState({ text: 'Screen sharing has ended.', speaker: 'jess', visible: true });
      }, { once: true });
      setSpeechState({ text: 'Screen sharing is active. Say “stop screen sharing” when you are done.', speaker: 'jess', visible: true });
    } catch (error: any) {
      if (share.stream) share.stream.getTracks().forEach(track => track.stop());
      share.stream = null;
      share.video = null;
      setSpeechState({ text: error?.message || 'Screen sharing was cancelled or permission was denied.', speaker: 'jess', visible: true });
    }
  }, [stopScreenSharing]);

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
      const share = screenShareRef.current;
      if (share.timer !== null) window.clearInterval(share.timer);
      share.timer = null;
      if (share.stream) share.stream.getTracks().forEach(track => track.stop());
      share.stream = null;
      if (share.video) { share.video.pause(); share.video.srcObject = null; }
      share.video = null;
      if (share.nativeListener?.remove) void share.nativeListener.remove().catch(() => undefined);
      share.nativeListener = null;
      if (share.nativePlugin?.stopSharing) void share.nativePlugin.stopSharing().catch(() => undefined);
      share.nativePlugin = null;
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
    await stopScreenSharing(false);
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setConnection('disconnected');
    setState('idle');
    setInputLevel(0);
    setOutputLevel(0);
    setSpeechState({ text: '', speaker: 'user', visible: false });
    setShowContextMenu(false);
  }, [stopScreenSharing]);

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

        if (result.actionPayload?.type === 'screen_share') {
          const p = result.actionPayload;
          const share = screenShareRef.current;
          const stopShare = async () => {
            if (share.timer !== null) window.clearInterval(share.timer);
            share.timer = null;
            if (share.stream) share.stream.getTracks().forEach(track => track.stop());
            share.stream = null;
            if (share.video) { share.video.pause(); share.video.srcObject = null; }
            share.video = null;
            if (share.nativeListener?.remove) await share.nativeListener.remove().catch(() => undefined);
            share.nativeListener = null;
            if (share.nativePlugin?.stopSharing) await share.nativePlugin.stopSharing().catch(() => undefined);
            share.nativePlugin = null;
          };
          if (p.action === 'stop') {
            await stopShare();
            setScreenSharingActive(false);
            result.result.message = 'Screen sharing has stopped.';
          } else if (!isJessInstalledApp()) {
            result.result = { success: false, error: 'Screen sharing is available only in the installed Hub-Mind app, not in a normal browser tab.' };
          } else {
            await stopShare();
            const nativeCapture = (window as any).Capacitor?.Plugins?.JessScreenCapture;
            if (nativeCapture?.startSharing && nativeCapture?.addListener) {
              try {
                share.nativePlugin = nativeCapture;
                share.nativeListener = await nativeCapture.addListener('frame', (event: any) => {
                  const frame = event?.dataUrl || (event?.data ? 'data:image/jpeg;base64,' + event.data : '');
                  if (frame) clientRef.current?.sendScreenFrame(frame);
                });
                await nativeCapture.startSharing({ frameRate: 1, maxWidth: 1280, imageQuality: 0.65 });
                setScreenSharingActive(true);
                clientRef.current?.sendText('SCREEN SHARE STATUS: Screen sharing is now active. You may receive periodic screen frames. Only describe what is visible in received frames; frames are snapshots, not continuous video.');
                result.result.message = 'Screen sharing is active. Jess will receive periodic screen frames while the operating system allows capture.';
              } catch (error: any) {
                await stopShare();
                result.result = { success: false, error: error?.message || 'Native screen sharing could not start. Check screen-capture permission.' };
              }
            } else {
              const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator as any).userAgentData?.mobile === true;
              if (mobile) {
                result.result = { success: false, error: 'This installed mobile web app does not yet have its native screen-capture bridge. Mobile cross-app sharing requires the native Android/iOS app and system capture permission.' };
              } else if (!navigator.mediaDevices?.getDisplayMedia) {
                result.result = { success: false, error: 'This installed app environment does not support screen capture. Use a supported installed desktop app build.' };
              } else {
                setScreenSharePrompt(true);
                result.result.message = 'I have opened the screen-sharing confirmation. Tap “Share screen” to choose what I can see.';
              }
            }
          }
        }

        // Screen-control actions are executed by the signed-in browser, not merely
        // acknowledged. This gives Jess direct, visible control of the Hub-Mind UI.
        if (result.actionPayload?.type === 'screen_control') {
          const p = result.actionPayload;
          const control = screenControlRef.current;
          const stopScroll = () => { if (control.timer !== null) window.clearInterval(control.timer); control.timer = null; control.running = false; };
          const mode = String(p.mode || 'by').toLowerCase();
          const direction = String(p.direction || (mode === 'left' || mode === 'right' ? mode : 'down')).toLowerCase();
          const horizontal = ['left', 'right'].includes(direction) || ['left', 'right'].includes(mode);
          const target = horizontal ? getJessHorizontalScrollTarget(String(p.target || '')) : getJessScrollTarget('y', String(p.target || ''));
          const isWindow = target === window;
          const metrics = () => {
            const el = isWindow ? document.scrollingElement as HTMLElement | null : target as HTMLElement;
            const position = horizontal ? (isWindow ? window.scrollX : (el?.scrollLeft || 0)) : (isWindow ? window.scrollY : (el?.scrollTop || 0));
            const extent = horizontal ? (isWindow ? Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth : (el?.scrollWidth || 0) - (el?.clientWidth || 0)) : (isWindow ? Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight : (el?.scrollHeight || 0) - (el?.clientHeight || 0));
            return { position, max: Math.max(0, extent) };
          };
          const scrollToEdge = (value: number) => {
            if (horizontal) { if (isWindow) window.scrollTo({ left: value, behavior: 'smooth' }); else (target as HTMLElement).scrollTo({ left: value, behavior: 'smooth' }); }
            else { if (isWindow) window.scrollTo({ top: value, behavior: 'smooth' }); else (target as HTMLElement).scrollTo({ top: value, behavior: 'smooth' }); }
          };
          const scrollByAmount = (amount: number) => {
            if (horizontal) { if (isWindow) window.scrollBy({ left: amount, behavior: 'smooth' }); else (target as HTMLElement).scrollBy({ left: amount, behavior: 'smooth' }); }
            else { if (isWindow) window.scrollBy({ top: amount, behavior: 'smooth' }); else (target as HTMLElement).scrollBy({ top: amount, behavior: 'smooth' }); }
          };
          if (p.action === 'stop' || mode === 'stop') { stopScroll(); result.result.message = 'Stopped scrolling.'; }
          else if (p.action === 'scroll') {
            const m = metrics(); const atStart = m.position <= 2; const atEnd = m.position >= m.max - 2;
            if (mode === 'top' || mode === 'left') {
              stopScroll();
              if (atStart) result.result.message = 'This area is already at its start edge; there is no more room to scroll that way.';
              else { scrollToEdge(0); result.result.message = 'Scrolled to the start of the selected area.'; }
            } else if (mode === 'bottom' || mode === 'right') {
              stopScroll();
              if (atEnd) result.result.message = 'This area is already at its end edge; there is no more room to scroll that way.';
              else { scrollToEdge(m.max); result.result.message = 'Scrolled to the end of the selected area.'; }
            } else if (mode === 'by') {
              stopScroll(); const sign = ['up', 'left'].includes(direction) ? -1 : 1;
              if ((sign < 0 && atStart) || (sign > 0 && atEnd)) result.result.message = 'I have reached the end of this scrollable area in that direction.';
              else { const amount = Math.max(50, Math.min(3000, Number(p.amount) || (horizontal ? window.innerWidth : window.innerHeight) * 0.72)); scrollByAmount(sign * amount); result.result.message = 'Scrolled the selected area.'; }
            } else {
              const speeds: Record<string, number> = { slow: 1.2, normal: 3, fast: 7, very_fast: 14 };
              control.speed = speeds[p.speed] || 3; control.axis = horizontal ? 'x' : 'y'; control.direction = ['up', 'left'].includes(direction) ? -1 : 1;
              stopScroll(); control.running = true;
              control.timer = window.setInterval(() => {
                if (!control.running) return;
                const m = metrics();
                if ((control.direction < 0 && m.position <= 1) || (control.direction > 0 && m.position >= m.max - 1)) { stopScroll(); return; }
                scrollByAmount(control.direction * control.speed);
              }, 16);
              result.result.message = 'Started scrolling. I will stop automatically at the edge.';
            }
          } else if (p.action === 'click') {
            const el = findJessVisibleElement(p.target, p.selector);
            if (!el) result.result = { success: false, error: 'I could not find a visible screen element matching that target.' };
            else { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => el.click(), 120); result.result.message = 'Clicked the visible screen element: ' + (p.target || p.selector || el.innerText || el.getAttribute('aria-label') || 'target'); }
          } else if (p.action === 'type') {
            const el = findJessVisibleElement(p.target, p.selector);
            if (!el) result.result = { success: false, error: 'I could not find a visible input or editor field matching that target.' };
            else {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus();
              if (p.clearFirst) { if ('value' in el) (el as HTMLInputElement).value = ''; else if (el.isContentEditable) el.textContent = ''; }
              if ('value' in el) { const input = el as HTMLInputElement; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(input, String(p.text || '')); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
              else if (el.isContentEditable) { el.textContent = String(p.text || ''); el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(p.text || '') })); }
              result.result.message = 'Typed into the visible screen field.';
            }
          }
        }

        clientRef.current?.sendFunctionResponse({ name: fc.name, id: fc.id, response: result.result });

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
        const stopShareCommand = /\b(stop|end|turn off|finish|cancel)\s+(?:the\s+)?(?:screen\s*sharing|screen share|sharing my screen)\b/i.test(text);
        if (stopShareCommand && (screenShareRef.current.stream || screenShareRef.current.nativePlugin || screenShareRef.current.timer !== null)) {
          void stopScreenSharing(true);
        }
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
    } catch (error: any) {
      const raw = error?.message ? String(error.message) : 'Unable to connect to Jess.';
      const lower = raw.toLowerCase();
      const userMessage =
        lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')
          ? 'Gemini is currently rejecting Jess because of an API rate or quota limit. Check your Gemini API usage/billing before trying again.'
          : lower.includes('503') || lower.includes('unavailable')
            ? 'Gemini Live is temporarily unavailable. Jess will need another connection attempt.'
            : raw;
      await stop();
      setSpeechState({ text: userMessage, speaker: 'jess', visible: true });
      setConnection('error');
      setState('error');
      scheduleFade(10000);
    }
  }, [connection, location.pathname, navigate, profile, stop, stopScreenSharing, updatePreferredName, scheduleFade]);

  const activate = useCallback(() => {
    if (connection === 'connected' || connection === 'connecting') void stop();
    else void start();
  }, [connection, start, stop]);


  // Passive wake is strictly app-only. Normal browser tabs must never leave a
  // background microphone listener running. Native shells can provide a native
  // wake plugin; installed desktop PWAs use browser recognition as a fallback.
  useEffect(() => {
    if (!profile || connection === 'connected' || connection === 'connecting' || !isJessInstalledApp()) return;
    let disposed = false;
    let nativeListener: { remove: () => Promise<void> } | null = null;
    const nativeWake = (window as any).Capacitor?.Plugins?.JessVoiceActivation;

    if (nativeWake?.addListener && nativeWake?.startListening) {
      void (async () => {
        try {
          nativeListener = await nativeWake.addListener('wake', (event: { prompt?: string }) => {
            if (disposed) return;
            wakeTone();
            void start(String(event?.prompt || '').trim() || undefined);
          });
          await nativeWake.startListening({ phrases: ['hey jess', 'hello jess', "what's up jess"] });
        } catch (error) {
          console.warn('[Jess] Native voice activation listener unavailable:', error);
        }
      })();
      return () => {
        disposed = true;
        void nativeListener?.remove();
        void Promise.resolve(nativeWake.stopListening?.()).catch(() => undefined);
      };
    }

    if (!isJessPcWakeSupported()) return;
    const wakeListener = new JessPcWakeListener({
      onWake: command => {
        if (disposed) return;
        wakeTone();
        void start(command || undefined);
      },
    });
    wakeListener.start();
    return () => { disposed = true; wakeListener.stop(); };
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
    p.longPressed = false;
    if (p.holdTimer !== null) window.clearTimeout(p.holdTimer);
    p.holdTimer = window.setTimeout(() => {
      p.longPressed = true;
      setShowOrbDismiss(true);
      try { if ('vibrate' in navigator) navigator.vibrate(18); } catch {}
    }, 750);
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
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      p.moved = true;
      if (p.holdTimer !== null) window.clearTimeout(p.holdTimer);
      p.holdTimer = null;
    }
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
    if (p.holdTimer !== null) window.clearTimeout(p.holdTimer);
    p.holdTimer = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    if (p.moved || p.longPressed) { p.longPressed = false; return; }
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
    const p = pointerRef.current;
    p.dragging = false;
    p.moved = false;
    p.longPressed = false;
    if (p.holdTimer !== null) window.clearTimeout(p.holdTimer);
    p.holdTimer = null;
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
          (active || speechState.visible) && speechState.text
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
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {speechState.speaker === 'user' ? 'You' : 'Jess'}{active ? ' · Live transcript' : ''}
              {screenSharingActive && <span className="ml-auto text-amber-300">Screen sharing</span>}
            </div>
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

      {/* Floating Assistant Orb Button */}
      {!orbDismissed && <button
        data-jess-orb="true"
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
      </button>}
      {showOrbDismiss && !orbDismissed && (
        <button
          type="button"
          aria-label="Remove Jess orb from this screen"
          title="Remove Jess from this screen"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => { setOrbDismissed(true); setShowOrbDismiss(false); setShowContextMenu(false); try { if ('vibrate' in navigator) navigator.vibrate([18, 35, 18]); } catch {} }}
          style={{ position: 'fixed', left: `${Math.min(96, Math.max(4, renderedPosition.x * 100 + 4))}%`, top: `${Math.max(4, renderedPosition.y * 100 - 4)}%`, zIndex: 10001 }}
          className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 border border-red-300 text-white shadow-lg flex items-center justify-center"
        ><X className="w-4 h-4" /></button>
      )}

      {screenSharePrompt && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="jess-screen-share-title" className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <h3 id="jess-screen-share-title" className="text-base font-semibold">Share your screen with Jess?</h3>
            <p className="mt-2 text-sm text-slate-400">Choose a screen or window in the system prompt. Jess will receive occasional frames while sharing is active. You can stop at any time.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setScreenSharePrompt(false)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={() => void beginDesktopScreenShare()} className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">Share screen</button>
            </div>
          </div>
        </div>
      )}

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
