import React from 'react';
import { Brain, X } from 'lucide-react';
import './companion.css';

declare global {
  interface Window {
    hubMindDesktop?: {
      showMain: () => Promise<boolean>;
      hideCompanion: () => Promise<boolean>;
    };
  }
}

export function CompanionPage() {
  return <main className="jess-orb-window" aria-label="Jess desktop companion">
    <div className="jess-orb-drag" title="Drag Jess anywhere on your screen" aria-label="Drag Jess anywhere on your screen">
      <button className="jess-orb-launch" type="button" aria-label="Open Jess workspace" title="Open Jess workspace" onClick={() => void window.hubMindDesktop?.showMain()}>
        <span className="jess-name">JESS</span><Brain size={39} strokeWidth={1.4} className="jess-brain" />
      </button>
    </div>
    <button className="jess-orb-close" type="button" title="Hide Jess" aria-label="Hide Jess" onClick={() => void window.hubMindDesktop?.hideCompanion()}><X size={13}/></button>
  </main>;
}
