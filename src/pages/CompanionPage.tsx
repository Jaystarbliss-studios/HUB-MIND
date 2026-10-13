import React, { useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { JessOrbVisualizer } from '../components/JessOrbVisualizer';
import { JessState } from '../services/liveAudioClient';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { watchJessSession, JessSessionOwner } from '../services/jessSessionCoordinator';
import './companion.css';

declare global {
  interface Window {
    hubMindDesktop?: {
      showMain: () => Promise<boolean>;
      hideCompanion: () => Promise<boolean>;
      moveCompanionBy: (dx: number, dy: number) => Promise<boolean>;
      setCompanionInteractive?: (interactive: boolean) => Promise<boolean>;
      setCompanionTranscriptVisible?: (visible: boolean) => Promise<boolean>;
      nativeStatus: () => Promise<{ active: boolean; startedAt?: string | null; userId?: string | null }>;  
    };
  }
}

export function CompanionPage() {
  const { profile } = useAuth();
  const [owner, setOwner] = useState<JessSessionOwner | null>(null);
  const [requestError, setRequestError] = useState('');
  const [controlActive, setControlActive] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ id: string; speaker: 'user' | 'jess'; text: string; at: number }>>([]);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const transcriptMessagesRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowTranscriptRef = useRef(true);
  const transcriptSnapshotRef = useRef('');
  const transcriptHideTimerRef = useRef<number | null>(null);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [orbVisual, setOrbVisual] = useState<{ state: JessState; inputLevel: number; outputLevel: number; connected: boolean }>({ state: 'idle', inputLevel: 0, outputLevel: 0, connected: false });

  useEffect(() => {
    const element = transcriptMessagesRef.current;
    if (element && shouldFollowTranscriptRef.current) element.scrollTop = element.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    if (!profile?.id) return;
    return watchJessSession(profile.id, setOwner);
  }, [profile?.id]);

  useEffect(() => {
    const key = 'hubmind.jess.desktopTranscript.v1';
    const load = () => {
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          const next = parsed.filter(item => item && (item.speaker === 'user' || item.speaker === 'jess') && typeof item.text === 'string').slice(-40);
          const snapshot = JSON.stringify(next);
          if (transcriptSnapshotRef.current && snapshot !== transcriptSnapshotRef.current) {
            setTranscriptVisible(true);
            if (transcriptHideTimerRef.current !== null) window.clearTimeout(transcriptHideTimerRef.current);
            transcriptHideTimerRef.current = window.setTimeout(() => {
              setTranscriptVisible(false);
            }, 12000);
          }
          transcriptSnapshotRef.current = snapshot;
          setTranscript(next);
        }
      } catch { /* Transcript is a convenience cache; never block the orb if it is unavailable. */ }
    };
    load();
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === key) load(); };
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(load, 1500);
    return () => { window.removeEventListener('storage', onStorage); window.clearInterval(interval); if (transcriptHideTimerRef.current !== null) window.clearTimeout(transcriptHideTimerRef.current); };
  }, []);

  useEffect(() => {
    const key = 'hubmind.jess.desktopOrbState.v1';
    const load = () => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        const allowed = new Set(['idle','listening','thinking','speaking','interrupted','muted','error']);
        if (allowed.has(value.state)) setOrbVisual({
          state: value.state as JessState,
          inputLevel: Number.isFinite(value.inputLevel) ? Math.max(0, Math.min(1, value.inputLevel)) : 0,
          outputLevel: Number.isFinite(value.outputLevel) ? Math.max(0, Math.min(1, value.outputLevel)) : 0,
          connected: value.connected === true,
        });
      } catch { /* Keep the default idle orb if state is unavailable. */ }
    };
    load();
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === key) load(); };
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(load, 180);
    return () => { window.removeEventListener('storage', onStorage); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!window.hubMindDesktop?.nativeStatus) return;
    let alive = true;
    const refresh = () => window.hubMindDesktop!.nativeStatus().then(status => { if (alive) setControlActive(status.active && status.userId === profile?.id); }).catch(() => { if (alive) setControlActive(false); });
    void refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    drag.current = { x: event.screenX, y: event.screenY, startX: event.screenX, startY: event.screenY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !(event.buttons & 1)) return;
    const dx = event.screenX - drag.current.x;
    const dy = event.screenY - drag.current.y;
    if (Math.abs(event.screenX - drag.current.startX) + Math.abs(event.screenY - drag.current.startY) > 5) drag.current.moved = true;
    if (dx || dy) {
      drag.current.x = event.screenX;
      drag.current.y = event.screenY;
      void window.hubMindDesktop?.moveCompanionBy(dx, dy);
    }
  };
  const handlePointerUp = () => {
    if (drag.current?.moved) window.setTimeout(() => { drag.current = null; }, 100);
    else drag.current = null;
  };

  const activateJess = async () => {
    if (drag.current?.moved) { drag.current = null; return; }
    drag.current = null;
    if (owner && owner.leaseUntil > Date.now()) {
      if (owner.client === 'windows-desktop') void window.hubMindDesktop?.showMain();
      else setRequestError(`Jess is already active in ${owner.client === 'installed-web-app' ? 'the installed Chrome app' : 'another Hub-Mind window'}. Stop that session before switching here.`);
      return;
    }
    if (!profile?.id) { setRequestError('Sign in to activate Jess.'); return; }
    try {
      const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `request-${Date.now()}`;
      await setDoc(doc(db, 'users', profile.id, 'private', 'jessActivationRequest'), {
        requestId, requestedAt: Date.now(), requestedBy: 'windows-desktop-companion', prompt: ''
      });
      setRequestError('');
    } catch (error) {
      console.warn('[Jess companion] Activation request failed:', error);
      setRequestError('Could not activate Jess. Open the workspace and try again.');
    }
  };

  const isActive = !!owner && owner.leaseUntil > Date.now();
  const localActive = isActive && owner?.client === 'windows-desktop';
  const remoteActive = isActive && !localActive;

  return <main className={`jess-orb-window${transcriptVisible ? " is-transcript-visible" : ""}`} aria-label="Jess desktop companion">
    <div className="jess-orb-drag" title="Drag to move Jess" aria-label="Drag to move Jess" onMouseEnter={() => void window.hubMindDesktop?.setCompanionInteractive?.(true)} onMouseLeave={() => void window.hubMindDesktop?.setCompanionInteractive?.(false)}>
      <button className="jess-orb-launch" type="button"
        aria-label={localActive ? 'Open the active Jess workspace' : remoteActive ? 'Jess is active in another Hub-Mind window' : 'Activate Jess'}
        title={localActive ? 'Jess is active — click to open workspace' : remoteActive ? 'Jess is active elsewhere; stop that session before switching' : 'Click to activate Jess'}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={() => void activateJess()}>
        <JessOrbVisualizer state={orbVisual.state} inputLevel={orbVisual.inputLevel} outputLevel={orbVisual.outputLevel} connected={orbVisual.connected} />
      </button>
    </div>
    {isActive && <span className={`jess-status-dot ${localActive ? 'is-local' : 'is-remote'}`} title={localActive ? 'Jess is active in this desktop app' : 'Jess is active in another Hub-Mind client'} />}
    {controlActive && <span className="jess-control-indicator" title="Full Control Session active — Ctrl+Alt+Shift+J stops native control" aria-label="Full Control Session active" />}
    {requestError && <span className="jess-orb-error" role="status" title={requestError}>!</span>}
    <div className="jess-orb-controls" aria-label="Jess overlay controls" onMouseEnter={() => void window.hubMindDesktop?.setCompanionInteractive?.(true)} onMouseLeave={() => void window.hubMindDesktop?.setCompanionInteractive?.(false)}>
      
      <button type="button" title="Hide Jess overlay" aria-label="Hide Jess overlay" onClick={() => void window.hubMindDesktop?.hideCompanion()}><X size={13}/></button>
    </div>
    <section className="jess-transcript" aria-label="Jess conversation transcript" onMouseEnter={() => void window.hubMindDesktop?.setCompanionInteractive?.(true)} onMouseLeave={() => void window.hubMindDesktop?.setCompanionInteractive?.(false)}>
      <header className="jess-transcript-header"><span>Jess conversation</span><span className={controlActive ? 'jess-transcript-live' : ''}>{controlActive ? 'Live' : 'Recent'}</span></header>
      <div className="jess-transcript-messages" aria-live="polite" ref={transcriptMessagesRef} onScroll={() => { const element = transcriptMessagesRef.current; shouldFollowTranscriptRef.current = !!element && element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
        {transcript.length === 0 ? <p className="jess-transcript-empty">Your conversation with Jess will appear here, including while Hub-Mind is minimised.</p> : transcript.map(item => <article className={'jess-transcript-message ' + item.speaker} key={item.id}><div>{item.speaker === 'user' ? 'You' : 'Jess'}</div><p>{item.text}</p></article>)}
      </div>
    </section>
  </main>;
}
