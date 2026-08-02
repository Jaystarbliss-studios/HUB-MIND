import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task, Meeting, DocumentInfo, Notification } from '../types';
import { isToday, isBefore, startOfDay, parseISO, format, differenceInMinutes } from 'date-fns';
import { CheckCircle2, Clock, Calendar as CalendarIcon, FileText, Loader2, Bell, Flame, Check, Folder } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Dashboard() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch tasks
        const tasksQuery = profile.role === 'admin' || profile.role === 'assistant' 
          ? query(collection(db, 'tasks')) 
          : query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksData = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(tasksData);

        // Fetch meetings
        if (profile.role !== 'staff' && profile.role !== 'teacher') {
          const meetingsQuery = query(collection(db, 'meetings'));
          const meetingsSnapshot = await getDocs(meetingsQuery);
          const meetingsData = meetingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting));
          setMeetings(meetingsData);
        }

        // Fetch documents
        const docsQuery = query(collection(db, 'documents'));
        const docsSnapshot = await getDocs(docsQuery);
        setDocuments(docsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentInfo)));

        // Fetch notifications
        const notifQuery = query(collection(db, 'notifications'), where('userId', '==', profile.id), where('read', '==', false));
        const notifSnapshot = await getDocs(notifQuery);
        setNotifications(notifSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));

        // Fetch quick notes
        const notesDoc = await getDoc(doc(db, 'users', profile.id, 'private', 'quickNotes'));
        if (notesDoc.exists()) {
          setNotes(notesDoc.data().content || '');
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, profile]);

  const handleSaveNotes = async () => {
    if (!profile) return;
    setSavingNotes(true);
    try {
      await setDoc(doc(db, 'users', profile.id, 'private', 'quickNotes'), {
        content: notes,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error saving notes:", error);
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await updateDoc(doc(db, 'tasks', task.id), { status: newStatus });
    } catch (err) {
      console.error(err);
      // Revert on error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const today = startOfDay(new Date());
  
  const todayTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'archived') return false;
    if (!t.deadline) return false;
    try {
      const parsed = parseISO(t.deadline);
      if (isNaN(parsed.getTime())) return false;
      const deadlineDate = startOfDay(parsed);
      return isBefore(deadlineDate, today) || isToday(deadlineDate);
    } catch {
      return false;
    }
  }).sort((a, b) => {
    const pMap: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (pMap[a.priority] ?? 2) - (pMap[b.priority] ?? 2);
  });

  const urgentTasksCount = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed' && t.status !== 'archived').length;
  const pendingApprovals = tasks.filter(t => t.status === 'waiting_review').length;
  
  const todayMeetings = meetings.filter(m => {
    try {
      if (!m.date) return false;
      const parsed = parseISO(m.date);
      if (isNaN(parsed.getTime())) return false;
      return isToday(parsed);
    } catch {
      return false;
    }
  }).sort((a, b) => {
    try {
      const timeA = parseISO(a.date).getTime();
      const timeB = parseISO(b.date).getTime();
      if (isNaN(timeA) || isNaN(timeB)) return 0;
      return timeA - timeB;
    } catch {
      return 0;
    }
  });
  
  const now = new Date();
  const nextMeeting = todayMeetings.find(m => {
    try {
      const parsed = parseISO(m.date);
      if (isNaN(parsed.getTime())) return false;
      return parsed > now;
    } catch { return false; }
  });
  const nextMeetingText = nextMeeting ? `Meeting in ${differenceInMinutes(parseISO(nextMeeting.date), now)}m` : `${todayMeetings.length} meetings today`;

  // Assume unread docs are those created in the last 24h
  const recentDocsCount = documents.filter(d => differenceInMinutes(now, parseISO(d.createdAt)) < 24 * 60).length;

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  // Daily Brief Component
  const DailyBrief = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 mb-6 md:mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-red-400">
          <Flame className="w-4 h-4" />
          <span className="text-sm font-bold">Urgent</span>
        </div>
        <span className="text-xl md:text-2xl font-bold text-white">{urgentTasksCount} tasks</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-blue-400">
          <CalendarIcon className="w-4 h-4" />
          <span className="text-sm font-bold">Schedule</span>
        </div>
        <span className="text-sm md:text-xl font-bold text-white leading-tight">{nextMeetingText}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-amber-400">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-bold">Review</span>
        </div>
        <span className="text-xl md:text-2xl font-bold text-white">{pendingApprovals} items</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-emerald-400">
          <Folder className="w-4 h-4" />
          <span className="text-sm font-bold">New Docs</span>
        </div>
        <span className="text-xl md:text-2xl font-bold text-white">{recentDocsCount} files</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Today Mode */}
      <div className="md:hidden flex flex-col p-4 pb-24 h-full min-h-0 bg-slate-950 overflow-y-auto">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Today</h2>
        <DailyBrief />
        
        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Morning (Tasks)</h3>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks due today.</p>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
                {todayTasks.map(task => (
                  <div key={task.id} className="p-4 flex items-start gap-3">
                    <button 
                      onClick={() => toggleTaskStatus(task)}
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center border mt-0.5 shrink-0 transition-colors",
                        task.status === 'completed' ? "bg-accent border-accent text-slate-950" : "border-slate-600 bg-slate-950"
                      )}
                    >
                      {task.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", task.status === 'completed' ? "text-slate-500 line-through" : "text-slate-200")}>
                        {task.title}
                      </p>
                      {task.priority === 'urgent' && <span className="text-[10px] font-bold text-red-400 uppercase">Urgent</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Afternoon (Meetings)</h3>
            {todayMeetings.length === 0 ? (
              <p className="text-sm text-slate-400">No meetings today.</p>
            ) : (
              <div className="space-y-2">
                {todayMeetings.map(m => (
                  <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200 truncate pr-4">{m.notesRaw.split('\n')[0] || 'Meeting'}</p>
                    <span className="text-sm text-accent font-bold shrink-0">{format(parseISO(m.date), 'h:mm a')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {notifications.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Notifications</h3>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 divide-y divide-slate-800">
                {notifications.map(n => (
                  <div key={n.id} className="py-2 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                    <p className="text-sm text-slate-300">{n.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Desktop: Fuller Dashboard */}
      <div className="hidden md:flex p-8 max-w-7xl mx-auto flex-col h-full min-h-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Good morning, {profile?.name?.split(' ')[0] || 'User'}</h2>
            <p className="text-slate-400">Here's what's happening today.</p>
          </div>
        </div>

        <DailyBrief />

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 flex-1 min-h-0">
          {/* Today's Schedule */}
          <div className="col-span-1 md:col-span-4 flex flex-col gap-4 min-h-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 shrink-0">Upcoming Meetings</h3>
            <div className="space-y-3 overflow-y-auto pr-2 pb-4">
              {todayMeetings.length === 0 ? (
                 <div className="bg-slate-900/50 p-4 rounded-xl border-l-4 border-slate-700 flex flex-col gap-1">
                   <span className="text-sm font-bold text-slate-400">No meetings today</span>
                 </div>
              ) : (
                 todayMeetings.map((m, idx) => (
                    <div key={m.id} className={`p-4 rounded-xl border-l-4 flex flex-col gap-1 ${idx === 0 ? 'bg-slate-900 border-accent' : 'bg-slate-900/50 border-slate-700'}`}>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold truncate">{m.notesRaw.split('\n')[0] || 'Meeting'}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{format(parseISO(m.date), 'hh:mm a')}</span>
                      </div>
                      {m.clientId && <span className={`text-xs ${idx === 0 ? 'text-accent' : 'text-slate-400'}`}>Client ID: {m.clientId}</span>}
                    </div>
                 ))
              )}
            </div>
          </div>

          {/* Urgent Tasks */}
          <div className="col-span-1 md:col-span-5 flex flex-col gap-4 min-h-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 shrink-0">Tasks for Review</h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden min-h-0">
              <div className="p-4 border-b border-slate-800 bg-slate-800/20 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Recent Operational Tasks</span>
                  <Link to="/tasks" className="text-xs text-accent font-bold hover:underline cursor-pointer">View All</Link>
                </div>
              </div>
              <div className="divide-y divide-slate-800 overflow-y-auto">
                {todayTasks.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500 text-center">No urgent tasks.</div>
                ) : (
                  todayTasks.slice(0, 5).map(task => (
                    <Link key={task.id} to={`/tasks/${task.id}`} className="p-4 hover:bg-slate-800/30 transition-colors cursor-pointer flex items-center justify-between block">
                      <div className="min-w-0 pr-4">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-slate-500 truncate">{task.description}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        task.priority === 'high' ? 'bg-accent/10 text-accent border border-accent/20' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {task.priority}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick Notes */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-4 min-h-0 h-[400px] md:h-auto">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 shrink-0">Personal Scratchpad</h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-5 relative overflow-hidden flex-1 min-h-0">
               <div className="absolute top-0 right-0 p-3">
                <FileText className="w-4 h-4 text-slate-700" />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down quick thoughts here..."
                className="flex-1 w-full bg-transparent text-sm text-slate-300 leading-relaxed resize-none focus:outline-none"
              />
              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center shrink-0">
                 <button 
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="text-xs text-slate-500 hover:text-accent flex items-center gap-1 transition-colors"
                 >
                   {savingNotes ? 'Saving...' : saveSuccess ? <><Check className="w-4 h-4 text-emerald-500" /> Saved!</> : <><span className="text-lg leading-none mb-0.5">+</span> Save note</>}
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
