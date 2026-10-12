import React, { useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Maximize2, Sparkles, X } from 'lucide-react';
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
    };
  }
}

export function CompanionPage() {
  const { profile } = useAuth();
  const [owner, setOwner] = useState<JessSessionOwner | null>(null);
  const [requestError, setRequestError] = useState('');
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    return watchJessSession(profile.id, setOwner);
  }, [profile?.id]);

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

  return <main className="jess-orb-window" aria-label="Jess desktop companion">
    <div className="jess-orb-drag" title="Drag to move Jess" aria-label="Drag to move Jess">
      <button className="jess-orb-launch" type="button"
        aria-label={localActive ? 'Open the active Jess workspace' : remoteActive ? 'Jess is active in another Hub-Mind window' : 'Activate Jess'}
        title={localActive ? 'Jess is active — click to open workspace' : remoteActive ? 'Jess is active elsewhere; stop that session before switching' : 'Click to activate Jess'}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={() => void activateJess()}>
        <img src="/jess-orb.svg" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <span className="jess-orb-fallback"><Sparkles size={26}/></span>
      </button>
    </div>
    {isActive && <span className={`jess-status-dot ${localActive ? 'is-local' : 'is-remote'}`} title={localActive ? 'Jess is active in this desktop app' : 'Jess is active in another Hub-Mind client'} />}
    {requestError && <span className="jess-orb-error" role="status" title={requestError}>!</span>}
    <div className="jess-orb-controls">
      <button type="button" title="Open Hub-Mind workspace" aria-label="Open Hub-Mind workspace" onClick={() => void window.hubMindDesktop?.showMain()}><Maximize2 size={12}/></button>
      <button type="button" title="Hide Jess overlay" aria-label="Hide Jess overlay" onClick={() => void window.hubMindDesktop?.hideCompanion()}><X size={13}/></button>
    </div>
  </main>;
}
