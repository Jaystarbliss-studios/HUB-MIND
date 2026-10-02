import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LiveAudioClient, JessState } from '../services/liveAudioClient';
import { executeJessTool } from '../lib/jessTools';
import { JessOrbVisualizer } from './JessOrbVisualizer';

const POSITION_KEY = 'hubmind.jess.position.v1';
const DEFAULT_POSITION = { x: 0.86, y: 0.88 };

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}

export function JessFloatingAssistant(){
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const clientRef = useRef<LiveAudioClient|null>(null);
  const pointerRef = useRef({ dragging:false, moved:false, startX:0, startY:0, originX:0, originY:0, lastTap:0 });
  const [position,setPosition] = useState(DEFAULT_POSITION);
  const [connection,setConnection] = useState<'disconnected'|'connecting'|'connected'|'error'>('disconnected');
  const [state,setState] = useState<JessState>('idle');
  const [inputLevel,setInputLevel] = useState(0);
  const [outputLevel,setOutputLevel] = useState(0);

  useEffect(()=>{ try { const saved=JSON.parse(localStorage.getItem(POSITION_KEY)||''); if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.y)) setPosition({x:clamp(saved.x,.04,.96),y:clamp(saved.y,.04,.96)}); } catch{} },[]);
  useEffect(()=>()=>{clientRef.current?.disconnect();clientRef.current=null;},[]);

  const stop = useCallback(async()=>{await clientRef.current?.disconnect();clientRef.current=null;setConnection('disconnected');setState('idle');setInputLevel(0);setOutputLevel(0);},[]);

  const start = useCallback(async()=>{
    if(clientRef.current) return;
    const client=new LiveAudioClient({
      onStatusChange:setConnection,
      onJessStateChange:setState,
      onUserTranscript:()=>{},
      onJessTranscript:()=>{},
      onTurnComplete:()=>{},
      onAudioLevel:(input,output)=>{setInputLevel(input);setOutputLevel(output)},
      onError:(error)=>console.error('[Jess]',error),
      onFunctionCall:async(fc)=>{
        const result=await executeJessTool(fc.name,fc.args,profile,(name)=>{void (async()=>{try{const authEvent=new CustomEvent('jess:preferred_name',{detail:{name}});window.dispatchEvent(authEvent);}catch{}})();});
        if(result.actionPayload?.type==='navigate'&&result.actionPayload.path) navigate(result.actionPayload.path);
        client.sendFunctionResponse({name:fc.name,id:fc.id,response:result.result});
      },
    });
    clientRef.current=client;
    try{
      await client.connect({page:location.pathname,documentId:location.pathname.startsWith('/documents/')?location.pathname.split('/')[2]:undefined,userName:profile?.preferredName||profile?.name?.split(' ')[0]||'there',userRole:profile?.role});
      window.setTimeout(()=>client.sendText(`Begin the session naturally. Greet ${profile?.preferredName||profile?.name?.split(' ')[0]||'the user'} by name, say you are Jess, and ask what they would like to do. Keep the greeting short.`),450);
    }catch{await stop();}
  },[location.pathname,navigate,profile,stop]);

  const activate=useCallback(()=>{ if(connection==='connected'||connection==='connecting') void stop(); else void start(); },[connection,start,stop]);

  const onPointerDown=(e:React.PointerEvent<HTMLButtonElement>)=>{ if(e.button!==undefined&&e.button!==0&&e.pointerType!=='touch')return; const p=pointerRef.current; p.dragging=true;p.moved=false;p.startX=e.clientX;p.startY=e.clientY;p.originX=position.x;p.originY=position.y;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onPointerMove=(e:React.PointerEvent<HTMLButtonElement>)=>{const p=pointerRef.current;if(!p.dragging)return;const dx=e.clientX-p.startX,dy=e.clientY-p.startY;if(Math.abs(dx)+Math.abs(dy)>6)p.moved=true;if(!p.moved)return;const next={x:clamp(p.originX+dx/window.innerWidth,.04,.96),y:clamp(p.originY+dy/window.innerHeight,.04,.96)};setPosition(next);try{localStorage.setItem(POSITION_KEY,JSON.stringify(next))}catch{}};
  const onPointerUp=(e:React.PointerEvent<HTMLButtonElement>)=>{const p=pointerRef.current;p.dragging=false;if(p.moved)return;const now=Date.now();if(now-p.lastTap<360){p.lastTap=0;activate();}else p.lastTap=now;};

  if(!profile) return null;
  const active=connection==='connected'||connection==='connecting';
  const size=active?76:64;
  return <button
    type="button"
    aria-label={active?'Double tap to end Jess live session':'Double tap to talk to Jess'}
    title="Double tap to talk to Jess"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onDoubleClick={(e)=>{e.preventDefault();activate();}}
    className={`fixed z-[9999] touch-none select-none rounded-full outline-none transition-[width,height,opacity,filter] duration-300 ${active?'opacity-100 drop-shadow-[0_0_24px_rgba(212,175,55,.28)]':'opacity-75 hover:opacity-100'}`}
    style={{left:`${position.x*100}%`,top:`${position.y*100}%`,width:size,height:size,transform:'translate(-50%,-50%)',background:'transparent',border:'0',padding:0,cursor:pointerRef.current.dragging?'grabbing':'grab'}}
  >
    <span className="absolute inset-0 rounded-full bg-transparent" />
    <JessOrbVisualizer state={state} inputLevel={inputLevel} outputLevel={outputLevel} connected={active}/>
  </button>;
}
