import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export function JessOrbPage() {
  const navigate = useNavigate();
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number } | null>(null);
  const desktop = (window as any).hubMindDesktop;
  const begin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { x: event.screenX, y: event.screenY, lastX: event.screenX, lastY: event.screenY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = event.screenX - drag.current.lastX;
    const dy = event.screenY - drag.current.lastY;
    drag.current.lastX = event.screenX;
    drag.current.lastY = event.screenY;
    if (dx || dy) void desktop?.moveCompanionBy?.(dx, dy);
  };
  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    const initial = drag.current;
    drag.current = null;
    if (initial && Math.abs(event.screenX - initial.x) < 5 && Math.abs(event.screenY - initial.y) < 5) {
      void desktop?.showMain?.().then(() => navigate('/workspace'));
    }
  };
  return <main className="jess-orb-window" aria-label="Jess desktop orb">
    <div className="jess-orb-drag" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; }} title="Drag to move Jess. Click to open Hub-Mind.">
      <img src="/jess-orb.svg" alt="Open Jess" draggable={false} />
    </div>
    <style>{`
      html,body,#root{width:96px!important;height:96px!important;min-height:96px!important;margin:0!important;overflow:hidden!important;background:transparent!important;color-scheme:dark}
      body{background:transparent!important}
      .jess-orb-window{width:96px;height:96px;background:transparent;overflow:hidden}
      .jess-orb-drag{width:96px;height:96px;display:grid;place-items:center;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
      .jess-orb-drag:active{cursor:grabbing}
      .jess-orb-drag img{width:88px;height:88px;object-fit:contain;filter:drop-shadow(0 5px 12px rgba(0,0,0,.36));pointer-events:none}
    `}</style>
  </main>;
}
