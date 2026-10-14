import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { readJessExecutionEvents, type JessExecutionEvent } from '../services/jessExecutionRuntime';
import { Brain, ShieldCheck, SlidersHorizontal, Loader2, MonitorCog } from 'lucide-react';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { JessMcpServersSettings } from '../components/JessMcpServersSettings';

type JessPreferences = {
  permissionMode: 'ask' | 'allow-routine' | 'allow-everything';
  fullControlEnabled: boolean;
  startInFullControl: boolean;
  confirmHighRiskOutLoud: boolean;
  memoryEnabled: boolean;
  contextEnabled: boolean;
  personalization: string;
  webResearchEnabled: boolean;
  screenVerificationEnabled: boolean;
};
const DEFAULTS: JessPreferences = {
  permissionMode: 'ask', fullControlEnabled: false, startInFullControl: false, confirmHighRiskOutLoud: true, memoryEnabled: true, contextEnabled: true,
  personalization: '', webResearchEnabled: true, screenVerificationEnabled: true,
};

export function JessSettings() {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<JessPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [desktopState, setDesktopState] = useState<{ active?: boolean; startedAt?: string | null } | null>(null);
  const [error, setError] = useState('');
  const [executionEvents, setExecutionEvents] = useState<JessExecutionEvent[]>([]);

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return; }
    return onSnapshot(doc(db, 'users', profile.id, 'private', 'jessSettings'), snapshot => {
      const loaded = { ...DEFAULTS, ...(snapshot.exists() ? snapshot.data() as Partial<JessPreferences> : {}) };
      setPrefs(current => JSON.stringify(current) === JSON.stringify(loaded) ? current : loaded);
      setHydrated(true);
      try { localStorage.setItem('hubmind.jess.preferences', JSON.stringify(loaded)); } catch {}
      void (async () => { try { const desktop = (window as any).hubMindDesktop; if (!desktop) return; const live = await desktop.setJessPreferences(loaded, profile.id); setDesktopState({ active: live?.fullControlActive === true, startedAt: live?.startedAt || null }); } catch { /* Browser workspace may run without the desktop shell. */ } })();
      setLoading(false);
    }, () => { setError('Could not load Jess settings. Check your connection and permissions.'); setLoading(false); });
  }, [profile?.id]);

  useEffect(() => {
    const refresh = () => setExecutionEvents(
      profile?.id
        ? readJessExecutionEvents().filter(event => event.userId === profile.id).slice().reverse().slice(0, 8)
        : [],
    );
    refresh();
    window.addEventListener('hubmind:jess-execution-event', refresh);
    return () => window.removeEventListener('hubmind:jess-execution-event', refresh);
  }, [profile?.id]);

  const update = <K extends keyof JessPreferences,>(key: K, value: JessPreferences[K]) => {
    setPrefs(current => ({ ...current, [key]: value }));
    setSaved(false);
  };
  useEffect(() => {
    if (!hydrated || !profile?.id) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSaving(true); setError('');
      try {
        await setDoc(doc(db, 'users', profile.id, 'private', 'jessSettings'), {
          ...prefs, updatedAt: new Date().toISOString(), updatedBy: profile.id,
        }, { merge: true });
        const desktop = (window as any).hubMindDesktop;
        if (desktop?.setJessPreferences) {
          const live = await desktop.setJessPreferences(prefs, profile.id);
          if (!cancelled) setDesktopState({ active: live?.fullControlActive === true, startedAt: live?.startedAt || null });
          if (live?.cancelled && !cancelled) setError('Full Control was not enabled because the native confirmation was cancelled.');
        }
        try { localStorage.setItem('hubmind.jess.preferences', JSON.stringify(prefs)); } catch {}
        if (!cancelled) setSaved(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not auto-save Jess settings.');
      } finally { if (!cancelled) setSaving(false); }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [hydrated, profile?.id, prefs]);

  if (loading) return <div className="p-8 text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" size={18}/> Loading Jess settings…</div>;
  return <div className="min-h-full bg-slate-950 text-slate-100 p-5 md:p-8">
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200 grid place-items-center"><SlidersHorizontal size={22}/></div>
        <div><p className="text-xs tracking-[.18em] uppercase text-teal-300 font-semibold">Personal assistant</p><h1 className="text-2xl md:text-3xl font-semibold mt-1">Jess settings</h1><p className="text-sm text-slate-400 mt-2 max-w-2xl">Set how Jess remembers you, uses context, researches the web, and handles desktop actions. These preferences are saved to your account.</p></div>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4"><ShieldCheck className="text-teal-300" size={20}/><div><h2 className="font-semibold">Desktop permissions</h2><p className="text-xs text-slate-400 mt-1">Changes auto-save and the desktop reports its live session state.</p></div></div>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 p-4 mb-4"><span><strong className="block text-sm">Full Control</strong><span className="block text-xs text-slate-400 mt-1">Enable Windows and connected Chrome controls when the desktop session is active.</span></span><input type="checkbox" checked={prefs.fullControlEnabled} onChange={e => update('fullControlEnabled', e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Permission mode</div>
          <label className="flex gap-3 rounded-xl border border-slate-800 p-4 cursor-pointer mb-3"><input type="radio" name="permissionMode" checked={prefs.permissionMode==='ask'} onChange={() => update('permissionMode','ask')} className="mt-1 accent-teal-400"/><span><strong className="block text-sm">Ask</strong><span className="block text-xs text-slate-400 mt-1">Ask before each mutating native action.</span></span></label>
          <label className="flex gap-3 rounded-xl border border-slate-800 p-4 cursor-pointer mb-3"><input type="radio" name="permissionMode" checked={prefs.permissionMode==='allow-routine'} onChange={() => update('permissionMode','allow-routine')} className="mt-1 accent-teal-400"/><span><strong className="block text-sm">Allow routine</strong><span className="block text-xs text-slate-400 mt-1">Routine desktop actions proceed without repeated prompts. High-impact operations still require explicit handling.</span></span></label>
          <label className="flex gap-3 rounded-xl border border-rose-400/25 bg-rose-400/5 p-4 cursor-pointer mb-4"><input type="radio" name="permissionMode" checked={prefs.permissionMode==='allow-everything'} onChange={() => update('permissionMode','allow-everything')} className="mt-1 accent-rose-400"/><span><strong className="block text-sm">Allow everything</strong><span className="block text-xs text-slate-400 mt-1">One native confirmation on first activation; then no per-action approval prompts while this mode remains enabled. Windows secure-desktop/UAC prompts cannot be automated.</span></span></label>
          <label className="flex items-center justify-between gap-4 py-3 border-t border-slate-800"><span><strong className="block text-sm">Start in Full Control when Hub-Mind launches</strong><span className="block text-xs text-slate-400">Uses your saved consent and current permission mode.</span></span><input type="checkbox" checked={prefs.startInFullControl} onChange={e => update('startInFullControl', e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <label className="flex items-center justify-between gap-4 py-3"><span><strong className="block text-sm">Ask out loud before high-impact actions</strong><span className="block text-xs text-slate-400">For deleting, formatting, shutting down or sending. Requires a verified spoken yes/no flow; this switch does not itself create speech confirmation.</span></span><input type="checkbox" checked={prefs.confirmHighRiskOutLoud} onChange={e => update('confirmHighRiskOutLoud', e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs text-slate-400" aria-live="polite">Desktop live state: <strong className={desktopState?.active ? 'text-emerald-300' : 'text-amber-200'}>{desktopState?.active ? 'Full Control active' : 'Not active / browser only'}</strong>{desktopState?.startedAt ? ` · Started ${new Date(desktopState.startedAt).toLocaleTimeString()}` : ''}</div>
        </section>
        <JessMcpServersSettings userId={profile?.id || ''} />
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4"><MonitorCog className="text-teal-300" size={20}/><div><h2 className="font-semibold">Recent Jess execution activity</h2><p className="text-xs text-slate-400 mt-1">A lightweight trace of tool execution. Argument values are not stored.</p></div></div>
          {executionEvents.length === 0 ? <p className="text-sm text-slate-500">No recent tool executions in this app session.</p> : <div className="space-y-2">
            {executionEvents.map(event => <div key={event.executionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="min-w-0"><p className="text-sm font-medium truncate">{event.toolName}</p><p className="text-xs text-slate-500">{new Date(event.at).toLocaleTimeString()} · {event.durationMs} ms</p></div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${event.status === 'failed' ? 'bg-rose-400/10 text-rose-300' : event.status === 'sent_unverified' ? 'bg-amber-400/10 text-amber-200' : 'bg-teal-400/10 text-teal-200'}`}>{event.status.replace(/_/g, ' ')}</span><span className="text-[10px] text-slate-500">{event.retrySafe ? 'read-only' : 'do not auto-retry'}</span></div>
            </div>)}
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
          <div className="flex items-center gap-3 mb-4"><Brain className="text-teal-300" size={20}/><div><h2 className="font-semibold">Memory and personalization</h2><p className="text-xs text-slate-400 mt-1">Control how Jess adapts to your working style.</p></div></div>
          <label className="flex items-center justify-between gap-4 py-3 border-b border-slate-800"><span><strong className="block text-sm">Remember useful details</strong><span className="text-xs text-slate-400">Allow Jess to store and use saved memories.</span></span><input type="checkbox" checked={prefs.memoryEnabled} onChange={e => update('memoryEnabled',e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <label className="flex items-center justify-between gap-4 py-3 border-b border-slate-800"><span><strong className="block text-sm">Use workspace context</strong><span className="text-xs text-slate-400">Use relevant open-page and workspace information.</span></span><input type="checkbox" checked={prefs.contextEnabled} onChange={e => update('contextEnabled',e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <label className="flex items-center justify-between gap-4 py-3"><span><strong className="block text-sm">Web research</strong><span className="text-xs text-slate-400">Allow Jess to use available online search and URL context tools.</span></span><input type="checkbox" checked={prefs.webResearchEnabled} onChange={e => update('webResearchEnabled',e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <label className="flex items-center justify-between gap-4 py-3 border-t border-slate-800"><span><strong className="block text-sm">Verify actions visually</strong><span className="text-xs text-slate-400">When screen access is available, ask Jess to inspect the result before claiming success.</span></span><input type="checkbox" checked={prefs.screenVerificationEnabled} onChange={e => update('screenVerificationEnabled',e.target.checked)} className="w-5 h-5 accent-teal-400"/></label>
          <label className="block mt-4"><span className="text-sm font-medium">Personalization instructions</span><textarea value={prefs.personalization} onChange={e => update('personalization',e.target.value.slice(0,2000))} rows={4} maxLength={2000} placeholder="For example: be concise, explain unfamiliar terms, prefer keyboard shortcuts, and use my preferred writing tone." className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-400 focus:outline-none"/></label>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex gap-3"><MonitorCog className="text-slate-400 shrink-0" size={19}/><p className="text-xs leading-relaxed text-slate-400">Full Control operates through the installed desktop app. The web workspace cannot itself control Windows. UAC secure-desktop prompts require user interaction.</p></section>
        <div className="flex items-center justify-end gap-3"><span aria-live="polite" className="text-xs text-emerald-300">{saving ? 'Saving…' : saved ? 'Auto-saved' : 'Changes save automatically'}</span></div>
      </div>
    </div>
  </div>;
}
