import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Users, Calendar, Folder, Bell, LogOut, Settings, Inbox, Plus, X, Brain, Book, Briefcase } from 'lucide-react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
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
];

export function Layout() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showCapture, setShowCapture] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [savingCapture, setSavingCapture] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const recurringChecked = useRef(false);

  useEffect(() => {
    if (profile && !recurringChecked.current) {
      recurringChecked.current = true;
          }
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
    const unsub = onSnapshot(q, (snap) => {
      setUnprocessedCount(snap.docs.length);
    });
    
    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.id),
      where('read', '==', false)
    );
    const notifUnsub = onSnapshot(notifQ, (snap) => {
      setUnreadNotifCount(snap.docs.length);
    });
    
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
      console.log('Failed to save to inbox.');
    } finally {
      setSavingCapture(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <Brain className="w-8 h-8 text-accent" />
          <h1 className="text-xl font-semibold tracking-tight text-white">Hub-Mind</h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-slate-800 text-accent" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
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
                <span className="ml-auto text-xs font-bold text-accent">{unprocessedCount}</span>
              )}
            </NavLink>
          ))}
          {profile?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-slate-800 text-accent" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
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
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Header - Desktop */}
        <header className="hidden md:flex h-16 border-b border-slate-800 items-center justify-end px-8 bg-slate-950/50 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-6">
            <NavLink to="/notifications" className="relative cursor-pointer group">
              <Bell className="w-6 h-6 text-slate-400 group-hover:text-slate-200 transition-colors" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full border-2 border-slate-950"></span>
              )}
            </NavLink>
            <button 
              onClick={() => setShowCapture(true)}
              className="bg-accent hover:bg-accent-hover text-slate-950 text-sm font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Quick Capture
            </button>
          </div>
        </header>

        {/* Header - Mobile */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur z-10 shrink-0">
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent" />
            Hub-Mind
          </h1>
          <div className="flex items-center gap-4">
            <NavLink to="/notifications" className="relative group">
              <Bell className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-slate-950"></span>
              )}
            </NavLink>
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-medium text-white border border-slate-600">
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
          className="md:hidden fixed bottom-20 right-4 w-12 h-12 bg-accent text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-accent/20 z-20 hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 w-full border-t border-slate-800 bg-slate-950/90 backdrop-blur flex justify-around p-2 pb-safe z-30">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex flex-col items-center p-2 text-[10px] font-medium transition-colors relative",
                isActive ? "text-accent" : "text-slate-500"
              )}
            >
              <item.icon className="w-5 h-5 mb-1" />
              {item.to === '/inbox' && unprocessedCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-accent rounded-full border-2 border-slate-950"></span>
              )}
              {item.label}
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
    </div>
  );
}
