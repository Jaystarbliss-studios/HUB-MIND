import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Users, Calendar, Folder, Bell, LogOut, Settings, Inbox, Plus, X, Brain, Book, Briefcase, Search, Clock3 } from 'lucide-react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { usePushNotifications } from '../lib/usePushNotifications';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { GlobalSearchModal } from './GlobalSearchModal';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { to: '/', label: 'Today', icon: LayoutDashboard },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/documents', label: 'Documents', icon: Folder },
  { to: '/knowledge', label: 'Knowledge', icon: Book },
  { to: '/follow-ups', label: 'Follow-ups', icon: Clock3 },
];

export function Layout() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showCapture, setShowCapture] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [savingCapture, setSavingCapture] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const recurringChecked = useRef(false);
  const { permission, requestPermission } = usePushNotifications(profile?.id);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!profile || recurringChecked.current || !['admin', 'assistant'].includes(profile.role)) return;
    recurringChecked.current = true;

    // Lightweight operational maintenance: generate due recurring tasks once
    // per signed-in workspace session. The template's lastGeneratedDate is
    // used as an idempotency guard so refreshes do not create duplicates.
    const runRecurringTaskMaintenance = async () => {
      try {
        const templateSnap = await getDocs(query(collection(db, 'recurringTaskTemplates'), where('active', '==', true)));
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);

        for (const templateDoc of templateSnap.docs) {
          const template = templateDoc.data() as any;
          if (template.lastGeneratedDate === todayKey) continue;

          const day = now.getDay();
          const date = now.getDate();
          const weekdayMatches = template.frequency === 'daily'
            || (template.frequency === 'weekly' && Number(template.dayOfWeek) === day)
            || (template.frequency === 'monthly' && Number(template.dayOfMonth) === date);

          if (!weekdayMatches) continue;

          const deadline = new Date(now);
          deadline.setHours(17, 0, 0, 0);

          await addDoc(collection(db, 'tasks'), {
            title: template.title,
            description: template.description || '',
            priority: template.priority || 'medium',
            status: 'pending',
            assignedTo: template.assignedTo || profile.id,
            createdBy: profile.id,
            deadline: deadline.toISOString(),
            checklist: [],
            comments: [],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            recurringTemplateId: templateDoc.id,
          });

          await updateDoc(doc(db, 'recurringTaskTemplates', templateDoc.id), {
            lastGeneratedDate: todayKey,
          });
        }
      } catch (error) {
        console.warn('Recurring task maintenance warning:', error);
      }
    };

    runRecurringTaskMaintenance();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = profile.role === 'admin' || profile.role === 'assistant'
      ? query(
          collection(db, 'inbox'),
          where('status', '==', 'unprocessed')
        )
      : query(
          collection(db, 'inbox'),
          where('status', '==', 'unprocessed'),
          where('createdBy', '==', profile.id)
        );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUnprocessedCount(snap.docs.length);
      },
      (err) => {
        console.warn('Inbox listener warning:', err);
      }
    );
    
    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      where('read', '==', false)
    );
    const notifUnsub = onSnapshot(
      notifQ,
      (snap) => {
        setUnreadNotifCount(snap.docs.length);
      },
      (err) => {
        console.warn('Notifications listener warning:', err);
      }
    );
    
    return () => {
      unsub();
      notifUnsub();
    };
  }, [profile]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureText.trim() || !profile) return;
    setSavingCapture(true);
    try {
      await addDoc(collection(db, 'inbox'), {
        text: captureText,
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
        status: 'unprocessed',
        convertedTo: null
      });
      setCaptureText('');
      setShowCapture(false);
    } catch (err) {
      console.error(err);
      
    } finally {
      setSavingCapture(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900 shrink-0 print:hidden">
        <div className="p-6 flex items-center gap-3">
          <Brain className="w-8 h-8 text-accent" />
          <h1 className="text-xl font-semibold tracking-tight text-white">Hub-Mind</h1>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive 
                  ? "bg-slate-800 text-accent font-semibold shadow-xs" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850 active:scale-[0.99]"
              )}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.to === '/inbox' && unprocessedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-slate-900"></span>
                )}
              </div>
              {item.label}
              {item.to === '/inbox' && unprocessedCount > 0 && (
                <span className="ml-auto text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">{unprocessedCount}</span>
              )}
            </NavLink>
          ))}
          {profile?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive 
                  ? "bg-slate-800 text-accent font-semibold shadow-xs" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850 active:scale-[0.99]"
              )}
            >
              <Settings className="w-5 h-5" />
              Users (Admin)
            </NavLink>
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-600" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
                <div className="w-full h-full bg-gradient-to-br from-accent to-slate-900 flex items-center justify-center font-semibold text-white">
                  {profile?.name?.charAt(0) || '?'}
                </div>
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate text-white">{profile?.name || 'Loading...'}</span>
              <span className="text-xs text-slate-500 truncate capitalize">{profile?.role || '---'}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative print:h-auto print:overflow-visible">
        {/* Header - Desktop */}
        <header className="hidden md:flex h-16 border-b border-slate-800 items-center justify-between px-8 bg-slate-950/50 backdrop-blur-sm z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-3 w-72">
            <button
              onClick={() => setShowSearchModal(true)}
              className="flex items-center justify-between w-full px-3 py-1.5 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Search workspace...</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700 font-mono">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <SyncStatusIndicator />

            {permission === 'default' && (
              <button 
                onClick={requestPermission}
                className="text-xs font-bold text-accent border border-accent/30 bg-accent/10 px-2 py-1 rounded hover:bg-accent/20 transition-colors hidden sm:block"
              >
                Enable Push
              </button>
            )}
            <NavLink to="/notifications" className="relative cursor-pointer group">
              <Bell className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full border-2 border-slate-950"></span>
              )}
            </NavLink>
            <button 
              onClick={() => setShowCapture(true)}
              className="bg-accent hover:bg-accent-hover text-slate-950 text-xs font-bold py-2 px-3.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Quick Capture
            </button>
          </div>
        </header>

        {/* Header - Mobile */}
        <header className="md:hidden flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-slate-800 bg-slate-950/80 backdrop-blur z-10 shrink-0 print:hidden">
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent" />
            Hub-Mind
          </h1>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
              title="Search workspace"
            >
              <Search className="w-4 h-4" />
            </button>

            <SyncStatusIndicator />
            
            {permission === 'default' && (
              <button 
                onClick={requestPermission}
                className="text-[10px] font-bold text-accent border border-accent/30 bg-accent/10 px-2 py-1 rounded hover:bg-accent/20 transition-colors"
              >
                Push
              </button>
            )}
            <NavLink to="/notifications" className="relative group">
              <Bell className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-slate-950"></span>
              )}
            </NavLink>
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-medium text-white border border-slate-600">
                {profile?.name?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* Mobile Floating Quick Capture Button */}
        <button
          onClick={() => setShowCapture(true)}
          className="md:hidden fixed bottom-20 right-4 w-12 h-12 bg-accent text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-accent/20 z-20 hover:scale-105 active:scale-95 transition-transform print:hidden"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 w-full border-t border-slate-800 bg-slate-950/95 backdrop-blur flex items-center justify-around overflow-x-auto snap-x hide-scrollbar px-1 py-1.5 pb-safe z-30 print:hidden shadow-lg">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all duration-150 relative min-w-[60px] min-h-[48px] snap-center shrink-0",
                isActive ? "text-accent font-semibold bg-slate-900/80" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <div className="relative">
                <item.icon className="w-5 h-5 mb-0.5" />
                {item.to === '/inbox' && unprocessedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border-2 border-slate-950"></span>
                )}
              </div>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>

      {/* Quick Capture Modal */}
      {showCapture && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/30">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Inbox className="w-4 h-4 text-accent" />
                Quick Capture
              </h3>
              <button onClick={() => setShowCapture(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCaptureSubmit} className="p-4 flex flex-col gap-4">
              <textarea
                autoFocus
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                placeholder="What's on your mind? Drop it here..."
                className="w-full bg-transparent text-lg text-white placeholder-slate-500 resize-none h-32 focus:outline-none"
              />
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={savingCapture || !captureText.trim()}
                  className="bg-accent hover:bg-accent-hover text-slate-950 font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingCapture ? 'Saving...' : 'Save to Inbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Workspace Search Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </div>
  );
}
