import React, { useRef } from 'react';
import { X, Maximize2, Sparkles } from 'lucide-react';
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
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
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
  const openWorkspace = () => {
    if (drag.current?.moved) { drag.current = null; return; }
    drag.current = null;
    void window.hubMindDesktop?.showMain();
  };

  return <main className="jess-orb-window" aria-label="Jess desktop companion">
    <div className="jess-orb-drag" title="Drag to move Jess" aria-label="Drag to move Jess">
      <button className="jess-orb-launch" type="button" aria-label="Open Jess and Hub-Mind workspace" title="Open Jess and Hub-Mind workspace"
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={openWorkspace}>
        <img src="/icon.svg" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <span className="jess-orb-fallback"><Sparkles size={26}/></span>
      </button>
    </div>
    <div className="jess-orb-controls">
      <button type="button" title="Open Hub-Mind workspace" aria-label="Open Hub-Mind workspace" onClick={() => void window.hubMindDesktop?.showMain()}><Maximize2 size={12}/></button>
      <button type="button" title="Hide Jess overlay" aria-label="Hide Jess overlay" onClick={() => void window.hubMindDesktop?.hideCompanion()}><X size={13}/></button>
    </div>
  </main>;
}
