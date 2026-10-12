import React from 'react';
import { X, Maximize2, Sparkles } from 'lucide-react';
import './companion.css';

declare global { interface Window { hubMindDesktop?: { showMain: () => Promise<boolean>; hideCompanion: () => Promise<boolean> } } }
export function CompanionPage() {
 return <main className="jess-orb-window" aria-label="Jess desktop companion">
  <div className="jess-orb-drag" title="Drag to move Jess" aria-label="Drag to move Jess">
   <button className="jess-orb-launch" type="button" aria-label="Open Jess and Hub-Mind workspace" title="Open Jess and Hub-Mind workspace" onClick={() => void window.hubMindDesktop?.showMain()}>
    <img src="/icon.svg" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><span className="jess-orb-fallback"><Sparkles size={26}/></span>
   </button>
  </div>
  <div className="jess-orb-controls"><button type="button" title="Open Hub-Mind workspace" aria-label="Open Hub-Mind workspace" onClick={() => void window.hubMindDesktop?.showMain()}><Maximize2 size={12}/></button><button type="button" title="Hide Jess overlay" aria-label="Hide Jess overlay" onClick={() => void window.hubMindDesktop?.hideCompanion()}><X size={13}/></button></div>
 </main>;
}
