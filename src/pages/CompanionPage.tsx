import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function CompanionPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  return <main className="min-h-screen bg-[#080b12] text-slate-100 p-5 flex flex-col">
    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-200 to-teal-700 text-slate-950 grid place-items-center"><Sparkles size={17}/></div>
      <div className="min-w-0"><h1 className="font-semibold text-sm">Jess</h1><p className="text-[10px] text-slate-400">Hub-Mind companion</p></div>
      <button onClick={() => navigate('/workspace')} className="ml-auto text-slate-400 hover:text-teal-200" aria-label="Open full workspace" title="Open full workspace"><ArrowUpRight size={17}/></button>
    </div>
    <section className="flex-1 flex flex-col justify-center pb-16">
      <p className="text-[10px] tracking-[.2em] text-teal-200/80 font-semibold">HERE WHEN YOU NEED ME</p>
      <h2 className="text-2xl font-semibold tracking-tight mt-3">What can I help you with?</h2>
      <p className="text-xs text-slate-400 leading-relaxed mt-3">Your companion stays on top while you work in other windows. Use the Jess orb to start a conversation, research an idea, or work through your next step.</p>
      <div className="mt-6 border border-white/10 bg-white/[.025] rounded-xl p-4"><p className="text-[11px] text-slate-300">Signed in as</p><p className="text-xs text-slate-400 mt-1 break-words">{profile?.email || 'Your Hub-Mind account'}</p></div>
    </section>
    <p className="text-[10px] text-slate-600 leading-relaxed">Jess's native system actions remain permission-controlled. Review each action before a file is opened or a change is made.</p>
  </main>;
}
