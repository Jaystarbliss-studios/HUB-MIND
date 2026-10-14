import React, { useEffect, useState } from 'react';

type ShareSource = {
  id: string;
  name: string;
  displayId?: string;
  isScreen: boolean;
  thumbnailDataUrl?: string;
};

export function ScreenShareChooserPage() {
  const [sources, setSources] = useState<ShareSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const desktop = (window as any).hubMindDesktop;
    if (!desktop?.isDesktopApp || typeof desktop.onScreenShareSources !== 'function') {
      setError('The desktop screen-share chooser is unavailable.');
      setLoading(false);
      return;
    }
    const unsubscribe = desktop.onScreenShareSources((items: ShareSource[]) => {
      setSources(Array.isArray(items) ? items : []);
      setLoading(false);
      setError('');
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const cancel = () => void (window as any).hubMindDesktop?.cancelScreenShareChooser?.();
  const choose = (id: string) => void (window as any).hubMindDesktop?.chooseScreenShareSource?.(id);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-300">Jess · Screen sharing</p>
            <h1 className="mt-2 text-2xl font-semibold">Choose what to share</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Select one display or application window. Only the selected source is shared.</p>
          </div>
          <button type="button" onClick={cancel} className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Cancel</button>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        {loading && <p className="text-sm text-slate-400">Loading available screens and windows…</p>}
        {!loading && !error && sources.length === 0 && <p className="rounded-xl border border-slate-800 p-5 text-sm text-slate-400">No shareable screens or windows were found.</p>}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map(source => (
            <button key={source.id} type="button" onClick={() => choose(source.id)} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-left transition hover:border-teal-300/60 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300">
              <div className="aspect-video w-full bg-slate-800">
                {source.thumbnailDataUrl
                  ? <img src={source.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center text-sm text-slate-500">Preview unavailable</div>}
              </div>
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-teal-300">{source.isScreen ? 'Display' : 'Application window'}</p>
                <p className="mt-1 truncate text-sm font-medium" title={source.name}>{source.name}</p>
              </div>
            </button>
          ))}
        </section>
        <footer className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">Press Cancel to keep your screen private. The chooser stays above other windows until you choose or cancel.</footer>
      </div>
    </main>
  );
}
