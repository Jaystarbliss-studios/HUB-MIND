import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ArrowRight, ArrowUpRight, Check, Download, FileText, FolderKanban, LockKeyhole, Menu, MessageCircle, Sparkles, X } from 'lucide-react';

const FEATURES = [
  { icon: FolderKanban, title: 'Your work, in one place', text: 'Projects, tasks, documents, meetings and follow-ups in one calm workspace.' },
  { icon: MessageCircle, title: 'Meet Jess', text: 'A thoughtful AI assistant designed to help you research, plan, write and keep moving.' },
  { icon: LockKeyhole, title: 'Invite-only by design', text: 'Your workspace stays private. Existing members sign in; new members need a valid invitation.' },
];

export function PublicHome() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteValue, setInviteValue] = useState('');
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [release, setRelease] = useState<{ url: string; name: string; version: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('https://api.github.com/repos/Jaystarbliss-studios/HUB-MIND/releases/latest')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('No public release yet')))
      .then(data => {
        const asset = (data.assets || []).find((item: any) => /\.exe$/i.test(item.name));
        if (active && asset) setRelease({ url: asset.browser_download_url, name: asset.name, version: data.tag_name || 'Latest' });
      })
      .catch(() => { if (active) setRelease(null); });
    return () => { active = false; };
  }, []);

  const openWorkspace = () => {
    if (loading) return;
    if (user && profile?.status === 'active') navigate('/workspace');
    else navigate('/login');
  };

  const submitInvite = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const raw = inviteValue.trim();
    if (!raw) { setError('Paste your invitation link or enter the invitation code.'); return; }
    let id = raw;
    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        id = url.searchParams.get('invite') || '';
      } else if (raw.includes('?') || raw.includes('/')) {
        const url = new URL(raw, window.location.origin);
        id = url.searchParams.get('invite') || '';
      }
    } catch { /* handled by validation below */ }
    id = id.trim();
    if (!/^[A-Za-z0-9_-]{8,160}$/.test(id)) {
      setError('That does not look like a valid Hub-Mind invitation. Use the full invitation link or its invitation ID.');
      return;
    }
    navigate('/login?invite=' + encodeURIComponent(id));
  };

  return (
    <div className="hm-public min-h-screen overflow-hidden">
      <header className="hm-nav">
        <a href="/" className="hm-brand" aria-label="Hub-Mind home">
          <span className="hm-brand-mark"><img src="/icon.svg" alt="" /></span>
          <span>Hub<span className="hm-brand-dash">-</span>Mind</span>
        </a>
        <nav className={mobileMenu ? 'hm-nav-links is-open' : 'hm-nav-links'}>
          <a href="#features" onClick={() => setMobileMenu(false)}>Workspace</a>
          <a href="#jess" onClick={() => setMobileMenu(false)}>Meet Jess</a>
          <a href="#desktop" onClick={() => setMobileMenu(false)}>Windows app</a>
        </nav>
        <div className="hm-nav-actions">
          <button className="hm-button hm-button-quiet hm-nav-invite" onClick={() => setInviteOpen(true)}>Get invite</button>
          <button className="hm-button hm-button-primary hm-nav-open" onClick={openWorkspace}>Open workspace <ArrowUpRight size={16}/></button>
        </div>
        <button className="hm-mobile-toggle" aria-label="Toggle navigation" onClick={() => setMobileMenu(v => !v)}>{mobileMenu ? <X/> : <Menu/>}</button>
      </header>

      <main>
        <section className="hm-hero">
          <div className="hm-hero-glow hm-glow-one" /><div className="hm-hero-glow hm-glow-two" />
          <div className="hm-hero-copy">
            <div className="hm-eyebrow"><span className="hm-live-dot" /> YOUR WORKSPACE, WITH A LITTLE MORE CLARITY</div>
            <h1>Make room for<br/><span>meaningful work.</span></h1>
            <p className="hm-hero-description">A quieter place to bring your work together. Plan the day, move projects forward, keep your knowledge close — and let Jess help with the busywork.</p>
            <div className="hm-hero-actions">
              <button className="hm-button hm-button-primary hm-button-large" onClick={openWorkspace}>Open workspace <ArrowRight size={17}/></button>
              <button className="hm-button hm-button-outline hm-button-large" onClick={() => setInviteOpen(true)}>I have an invite</button>
            </div>
            <div className="hm-trust-line"><LockKeyhole size={14}/> Private, invitation-based access <span>·</span> Built for focused work</div>
          </div>
          <div className="hm-hero-art" aria-label="Hub-Mind workspace preview">
            <div className="hm-orbit hm-orbit-outer"/><div className="hm-orbit hm-orbit-inner"/>
            <div className="hm-glass-card hm-work-card">
              <div className="hm-card-top"><span className="hm-mini-logo"><img src="/icon.svg" alt=""/></span><span>MONDAY, AT A GLANCE</span><span className="hm-card-dot"/></div>
              <h3>Good morning.</h3><p className="hm-card-muted">Here's what deserves your attention.</p>
              <div className="hm-progress-row"><span className="hm-progress-icon teal"><Check size={14}/></span><div><b>Review project milestones</b><small>Website redesign · Today</small></div><span className="hm-check">✓</span></div>
              <div className="hm-progress-row"><span className="hm-progress-icon purple"><FileText size={14}/></span><div><b>Finish the proposal</b><small>Client work · In progress</small></div><span className="hm-task-dot"/></div>
              <div className="hm-progress-row"><span className="hm-progress-icon amber"><MessageCircle size={14}/></span><div><b>Prepare for your meeting</b><small>Notes and next steps</small></div><span className="hm-task-dot"/></div>
              <div className="hm-card-footer"><span>YOUR DAY, IN FOCUS</span><span>03 tasks in view</span></div>
            </div>
            <div className="hm-float-note hm-note-jess"><span className="hm-jess-orb"><Sparkles size={17}/></span><span><b>Jess is ready</b><small>What shall we work on?</small></span><span className="hm-note-arrow">↗</span></div>
            <div className="hm-float-note hm-note-sync"><span className="hm-sync-check"><Check size={13}/></span><span><b>Everything together</b><small>Tasks · Docs · Projects</small></span></div>
          </div>
          <div className="hm-scroll-cue"><span/> A calmer way to work</div>
        </section>

        <section id="features" className="hm-features section-shell">
          <div className="hm-section-heading"><div className="hm-eyebrow">THE WORKSPACE</div><h2>Less scattered.<br/><span>More in sync.</span></h2><p>Everything you need to organise your work, without another noisy place to manage.</p></div>
          <div className="hm-feature-grid">{FEATURES.map((feature, i) => <article className="hm-feature" key={feature.title}><div className={'hm-feature-icon tone-' + i}><feature.icon size={20}/></div><span className="hm-feature-index">0{i+1}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>

        <section id="jess" className="hm-jess-section">
          <div className="hm-jess-visual"><div className="hm-jess-ring ring-a"/><div className="hm-jess-ring ring-b"/><div className="hm-jess-core"><div className="hm-jess-core-inner"><Sparkles size={32}/></div></div><div className="hm-jess-caption">YOUR THOUGHT PARTNER</div></div>
          <div className="hm-jess-copy"><div className="hm-eyebrow">MEET JESS</div><h2>A little help.<br/><span>Right when you need it.</span></h2><p>Jess is Hub-Mind's AI assistant, designed to help you think things through, find information, draft and refine ideas, and turn conversations into clear next steps — while keeping you in control.</p><ul><li><Check size={16}/> Research with source-aware answers</li><li><Check size={16}/> Help with writing, planning and follow-through</li><li><Check size={16}/> Voice interaction and a floating assistant</li></ul><button className="hm-text-link" onClick={openWorkspace}>Meet Jess in your workspace <ArrowRight size={16}/></button><p className="hm-credit">Jess was designed and programmed by Jaystarbliss, founder of Jaystarbliss Studios. Her underlying AI model is provided by Google.</p></div>
        </section>

        <section id="desktop" className="hm-desktop-section">
          <div className="hm-desktop-copy"><div className="hm-eyebrow">TAKE IT WITH YOU</div><h2>Your workspace.<br/><span>At home on Windows.</span></h2><p>{release ? 'The Hub-Mind Windows desktop installer is available now, with a dedicated window and a persistent Jess companion.' : 'A dedicated Windows desktop experience is being prepared. The installer will appear here as soon as a release is published and verified.'}</p>
          <div className="hm-desktop-points"><span><Check size={15}/> Dedicated desktop window</span><span><Check size={15}/> Floating Jess companion</span><span><Check size={15}/> Controlled system integrations</span></div>
          {release ? <a className="hm-button hm-button-primary hm-button-large" href={release.url}><Download size={17}/> Download for Windows <span className="hm-version">{release.version}</span></a> : <button className="hm-button hm-button-disabled hm-button-large" disabled title="A verified Windows installer has not been published yet"><Download size={17}/> Windows app coming soon</button>}
          {release && <small className="hm-release-name">{release.name}</small>}
          </div>
          <div className="hm-desktop-art"><div className="hm-monitor"><div className="hm-monitor-top"><span/><span/><span/><small>HUB-MIND / WORKSPACE</small></div><div className="hm-monitor-content"><div className="hm-monitor-sidebar"><i/><i/><i/><i/></div><div className="hm-monitor-main"><div className="hm-monitor-kicker">YOUR WORKSPACE</div><div className="hm-monitor-title">Make today count.</div><div className="hm-monitor-bars"><i/><i/><i/></div><div className="hm-monitor-bottom"><span/><span/><span/></div></div></div></div><div className="hm-monitor-stand"/><div className="hm-monitor-base"/><div className="hm-desktop-orb"><Sparkles size={20}/></div></div>
        </section>
      </main>

      <footer className="hm-footer"><div className="hm-footer-top"><a href="/" className="hm-brand"><span className="hm-brand-mark"><img src="/icon.svg" alt=""/></span><span>Hub<span className="hm-brand-dash">-</span>Mind</span></a><p>Make room for meaningful work.</p><button className="hm-button hm-button-outline" onClick={openWorkspace}>Open workspace <ArrowRight size={15}/></button></div><div className="hm-footer-bottom"><span>© {new Date().getFullYear()} Hub-Mind</span><span>Designed and built by <a href="https://jaystarbliss-studios.name.ng" target="_blank" rel="noreferrer">Jaystarbliss Studios</a> (JSW)</span><a href="mailto:hello@jaystarbliss-studios.name.ng">Contact</a></div></footer>

      {inviteOpen && <div className="hm-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setInviteOpen(false); }}><section className="hm-invite-modal" role="dialog" aria-modal="true" aria-labelledby="hm-invite-title"><button className="hm-modal-close" onClick={() => setInviteOpen(false)} aria-label="Close"><X size={18}/></button><div className="hm-modal-icon"><LockKeyhole size={22}/></div><div className="hm-eyebrow">WORKSPACE ACCESS</div><h2 id="hm-invite-title">Your invitation is the key.</h2><p>Paste the full Hub-Mind invitation link or enter the invitation ID shared by your workspace administrator.</p><form onSubmit={submitInvite}><label htmlFor="hm-invite-code">Invitation link or code</label><input id="hm-invite-code" autoFocus value={inviteValue} onChange={event => setInviteValue(event.target.value)} placeholder="Paste link or invitation ID" autoComplete="off"/>{error && <p className="hm-form-error" role="alert">{error}</p>}<button className="hm-button hm-button-primary hm-button-large" type="submit">Continue to sign in <ArrowRight size={16}/></button></form><p className="hm-modal-footnote">Invitations expire after seven days and are tied to the invited Google account.</p></section></div>}
    </div>
  );
}
