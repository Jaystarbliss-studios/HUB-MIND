import React, { useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';

declare global {
  interface Window {
    hubMindDesktop?: {
      showMain: () => Promise<boolean>;
      hideCompanion: () => Promise<boolean>;
    };
  }
}

export function CompanionPage() {
  useEffect(() => {
    document.body.classList.add('jess-companion-active');
    return () => document.body.classList.remove('jess-companion-active');
  }, []);
  return <div className="jess-companion-shell">
    <div className="jess-companion-drag" aria-label="Move Jess" title="Drag to move Jess">
      <span className="jess-companion-title">JESS</span>
      <button type="button" className="jess-companion-open" title="Open Hub-Mind workspace" aria-label="Open Hub-Mind workspace" onClick={() => void window.hubMindDesktop?.showMain()}><Maximize2 size={12}/></button>
      <button type="button" className="jess-companion-close" title="Hide Jess overlay" aria-label="Hide Jess overlay" onClick={() => void window.hubMindDesktop?.hideCompanion()}><X size={13}/></button>
    </div>
  </div>;
}
