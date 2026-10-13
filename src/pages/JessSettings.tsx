import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { readJessExecutionEvents, type JessExecutionEvent } from '../services/jessExecutionRuntime';
import { Brain, ShieldCheck, SlidersHorizontal, Save, Loader2, MonitorCog } from 'lucide-react';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { JessMcpServersSettings } from '../components/JessMcpServersSettings';

type JessPreferences = {
  permissionMode: 'ask' | 'always-allow';
  memoryEnabled: boolean;
  contextEnabled: boolean;
  personalization: string;
  webResearchEnabled: boolean;
  screenVerificationEnabled: boolean;
};
const DEFAULTS: JessPreferences = {
  permissionMode: 'ask', memoryEnabled: true, contextEnabled: true,
  personalization: '', webResearchEnabled: true, screenVerificationEnabled: true,
};

export function JessSettings() {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<JessPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [executionEvents, setExecutionEvents] = useState<JessExecutionEvent[]>([]);

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return; }
    return onSnapshot(doc(db, 'users', profile.id, 'private', 'jessSettings'), snapshot => {
      const loaded = { ...DEFAULTS, ...(snapshot.exists() ? snapshot.data() as Partial<JessPreferences> : {}) };
      setPrefs(loaded);
      try { localStorage.setItem('hubmind.jess.preferences', JSON.stringify(loaded)); } catch {}
      void (window as any).hubMindDesktop?.setJessPreferences?.(loaded, profile.id).catch(() => {});
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
  const save = async () => {
    if (!profile?.id) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await setDoc(doc(db, 'users', profile.id, 'private', 'jessSettings'), {
        ...prefs, updatedAt: new Date().toISOString(), updatedBy: profile.id,
      }, { merge: true });
      try { await (window as any).hubMindDesktop?.setJessPreferences?.(prefs, profile.id); } catch { /* Browser settings remain saved in the workspace. */ }
      try { localStorage.setItem('hubmind.jess.preferences', JSON.stringify(prefs)); } catch {}
      setSaved(true);
    } catch (e: any) { setError(e?.message || 'Could not save Jess settings.'); }
    finally { setSaving(false); }
  };

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
          <div className="flex items-center gap-3 mb-4"><ShieldCheck className="text-teal-300" size={20}/><div><h2 className="font-semibold">Desktop permissions</h2><p className="text-xs text-slate-400 mt-1">Choose how often Jess asks before native actions.</p></div></div>
          <label className="flex gap-3 rounded-xl border border-slate-800 p-4 cursor-pointer mb-3"><input type="radio" name="permissionMode" checked={prefs.permissionMode==='ask'} onChange={() => update('permissionMode','ask')} className="mt-1 accent-teal-400"/><span><strong className="block text-sm">Always ask</strong><span className="block text-xs text-slate-400 mt-1">Confirm app launches and system commands each time.</span></span></label>
          <label className="flex gap-3 rounded-xl border border-teal-400/25 bg-teal-400/5 p-4 cursor-pointer"><input type="radio" name="permissionMode" checked={prefs.permissionMode==='always-allow'} onChange={() => update('permissionMode','always-allow')} className="mt-1 accent-teal-400"/><span><strong className="block text-sm">Always allow routine actions during Full Control</strong><span className="block text-xs text-slate-400 mt-1">Jess can launch approved apps and perform supported, non-destructive actions without repeated prompts. Destructive or elevated actions remain blocked or require explicit confirmation.</span></span></label>
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
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex gap-3"><MonitorCog className="text-slate-400 shrink-0" size={19}/><p className="text-xs leading-relaxed text-slate-400">Windows system access is available only in the signed-in desktop app during an active Full Control session. Browser and Chrome-app permissions are limited by the browser sandbox.</p></section>
        <div className="flex items-center justify-end gap-3"><span aria-live="polite" className="text-xs text-emerald-300">{saved ? 'Settings saved' : ''}</span><button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save Jess settings</button></div>
      </div>
    </div>
  </div>;
}
