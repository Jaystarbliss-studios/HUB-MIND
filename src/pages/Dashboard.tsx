import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useLoading } from '../lib/loadingContext';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task, Meeting, Client, DocumentInfo, InboxItem, ActivityLog } from '../types';
import { safeParseISO, safeFormat } from "../lib/dateUtils";
import { isToday, isBefore, startOfDay, parseISO, format, startOfWeek, endOfWeek } from 'date-fns';
import { CheckCircle2, Clock, Calendar as CalendarIcon, FileText, Loader2, Bell, Users, Inbox, Activity, Check, Clock3 } from 'lucide-react';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  
  if (hour >= 0 && hour < 5) {
    const greetings = [
      `Welcome Midnight Owl, ${name}!`,
      `Working late, ${name}?`,
      `The world sleeps, but you conquer, ${name}.`,
      `Early wee hours, ${name}!`,
      `Still awake, ${name}?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else if (hour >= 5 && hour < 12) {
    const greetings = [
      `GOOD MORNING, ${name}!`,
      `Early work, ${name}?`,
      `Rise and shine, ${name}!`,
      `Ready to seize the day, ${name}?`,
      `A fresh start, ${name}!`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else if (hour >= 12 && hour < 17) {
    const greetings = [
      `Afternoon! ${name}.`,
      `Keep up the momentum, ${name}!`,
      `Hope your day is going well, ${name}.`,
      `Afternoon hustle, ${name}!`,
      `Halfway there, ${name}!`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else if (hour >= 17 && hour < 21) {
    const greetings = [
      `A cool evening, ${name}.`,
      `Good evening, ${name}!`,
      `Winding down the day, ${name}?`,
      `Evening productivity, ${name}!`,
      `Hope you had a great day, ${name}.`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else {
    const greetings = [
      `Good night, ${name}!`,
      `Late night hustle, ${name}?`,
      `Nighttime productivity, ${name}!`,
      `Almost time to rest, ${name}.`,
      `Wrapping up the night, ${name}?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

export function Dashboard() {
  const { user, profile } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const [loading, setLoading] = useState(true);

  // Data states
  const [urgentTasksCount, setUrgentTasksCount] = useState(0);
  const [todayMeetingsCount, setTodayMeetingsCount] = useState(0);
  const [clientsWaitingCount, setClientsWaitingCount] = useState(0);
  const [inboxItemsCount, setInboxItemsCount] = useState(0);
  const [tasksOverdueCount, setTasksOverdueCount] = useState(0);
  const [meetingsThisWeekCount, setMeetingsThisWeekCount] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);
  const [followUpsWaitingCount, setFollowUpsWaitingCount] = useState(0);
  const [documentsAttentionCount, setDocumentsAttentionCount] = useState(0);
  const [paymentsAwaitingCount, setPaymentsAwaitingCount] = useState(0);
  const [weekTasksCount, setWeekTasksCount] = useState(0);
  const [reportText, setReportText] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [greeting, setGreeting] = useState('Welcome!');

  useEffect(() => {
    if (profile?.name) {
      const firstName = profile.name.split(' ')[0];
      setGreeting(getGreeting(firstName));
    }
  }, [profile?.name]);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      startLoading('dashboard');
      try {
        const today = new Date();
        const startOfToday = startOfDay(today);
        const weekStart = startOfWeek(today);
        const weekEnd = endOfWeek(today);

        // Fetch Tasks (Urgent, Overdue, Total, Completed)
        try {
          const tasksQuery = profile.role === 'admin' || profile.role === 'assistant' 
             ? query(collection(db, 'tasks'))
             : query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
          const tasksSnap = await getDocs(tasksQuery);
          let urgentTasks = 0;
          let overdueTasks = 0;
          let completedTasks = 0;
          tasksSnap.docs.forEach(doc => {
            const t = doc.data() as Task;
            if (t.status === 'completed') {
              completedTasks++;
            } else if (t.status !== 'archived') {
              if (t.priority === 'urgent') urgentTasks++;
              if (t.deadline && isBefore(safeParseISO(t.deadline), startOfToday)) overdueTasks++;
            }
          });
          setUrgentTasksCount(urgentTasks);
          setTasksOverdueCount(overdueTasks);
          setTotalTasksCount(tasksSnap.docs.length);
          setCompletedTasksCount(completedTasks);
          setWeekTasksCount(tasksSnap.docs.filter(d => {
            const t = d.data() as Task;
            return t.deadline && safeParseISO(t.deadline) >= weekStart && safeParseISO(t.deadline) <= weekEnd && t.status !== 'archived';
          }).length);
        } catch (e) {
          console.warn('Dashboard tasks query warning:', e);
        }

        // Fetch Projects for Progress Ring
        try {
          const projSnap = await getDocs(collection(db, 'projects'));
          setTotalProjectsCount(projSnap.docs.length);
          const active = projSnap.docs.filter(d => (d.data() as any).status === 'active').length;
          setActiveProjectsCount(active);
        } catch (e) {
          console.warn('Dashboard projects query warning:', e);
        }

        // Fetch Meetings
        try {
          const meetingsQuery = query(collection(db, 'meetings'));
          const meetingsSnap = await getDocs(meetingsQuery);
          let meetingsToday = 0;
          let meetingsWeek = 0;
          meetingsSnap.docs.forEach(doc => {
            const m = doc.data() as Meeting;
            const mDate = safeParseISO(m.date);
            if (isToday(mDate)) meetingsToday++;
            if (mDate >= weekStart && mDate <= weekEnd) meetingsWeek++;
          });
          setTodayMeetingsCount(meetingsToday);
          setMeetingsThisWeekCount(meetingsWeek);
        } catch (e) {
          console.warn('Dashboard meetings query warning:', e);
        }

        // Fetch Clients Waiting (Lead status)
        try {
          const clientsQuery = query(collection(db, 'clients'), where('status', '==', 'lead'));
          const clientsSnap = await getDocs(clientsQuery);
          setClientsWaitingCount(clientsSnap.docs.length);
        } catch (e) {
          console.warn('Dashboard clients query warning:', e);
        }

        // Fetch Inbox Items
        try {
          const inboxQuery = profile.role === 'admin' || profile.role === 'assistant'
             ? query(collection(db, 'inbox'), where('status', '==', 'unprocessed'))
             : query(collection(db, 'inbox'), where('status', '==', 'unprocessed'), where('createdBy', '==', profile.id));
          const inboxSnap = await getDocs(inboxQuery);
          setInboxItemsCount(inboxSnap.docs.length);
        } catch (e) {
          console.warn('Dashboard inbox query warning:', e);
        }

        // Fetch operational follow-ups. Assistant/Admin see the workspace; other users see their own.
        try {
          const followUpsQuery = profile.role === 'admin' || profile.role === 'assistant'
            ? query(collection(db, 'followUps'))
            : query(collection(db, 'followUps'), where('ownerId', '==', profile.id));
          const followUpsSnap = await getDocs(followUpsQuery);
          const active = followUpsSnap.docs.filter(d => !['resolved', 'cancelled'].includes((d.data() as any).status));
          const now = Date.now();
          setFollowUpsDueCount(active.filter(d => new Date((d.data() as any).dueAt).getTime() <= now).length);
          setFollowUpsWaitingCount(active.filter(d => (d.data() as any).status === 'waiting').length);
        } catch (e) {
          console.warn('Dashboard follow-up query warning:', e);
        }

        // Documents needing attention: support common review/draft flags without assuming a field exists.
        try {
          const docsSnap = await getDocs(collection(db, 'documents'));
          const attention = docsSnap.docs.filter(d => {
            const x = d.data() as any;
            return x.status === 'pending_review' || x.status === 'needs_review' || x.reviewRequired === true;
          }).length;
          setDocumentsAttentionCount(attention);
        } catch (e) {
          console.warn('Dashboard documents query warning:', e);
        }

        // Payments awaiting confirmation. The collection is optional; an absent/empty collection is simply zero.
        try {
          const paymentsSnap = await getDocs(collection(db, 'payments'));
          const awaiting = paymentsSnap.docs.filter(d => {
            const x = d.data() as any;
            return ['pending', 'awaiting_confirmation', 'awaiting_payment', 'pending_confirmation'].includes(x.status);
          }).length;
          setPaymentsAwaitingCount(awaiting);
        } catch (e) {
          console.warn('Dashboard payments query warning:', e);
        }

        // Fetch Quick Notes
        try {
          const notesDoc = await getDoc(doc(db, 'users', profile.id, 'private', 'quickNotes'));
          if (notesDoc.exists()) {
            setNotes(notesDoc.data().content || '');
          }
        } catch (e) {
          console.warn('Dashboard quick notes warning:', e);
        }

        // Fetch Recent Activity
        try {
          const activityQuery = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(10));
          const activitySnap = await getDocs(activityQuery);
          setRecentActivity(activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
        } catch (e) {
          console.warn('Dashboard activity query warning:', e);
        }

      } catch (error) {
        console.error("Error fetching operations hub data", error);
      } finally {
        setLoading(false);
        stopLoading('dashboard');
      }
    };

    fetchData();
  }, [profile, startLoading, stopLoading]);

  const saveDailyReport = async () => {
    if (!profile || !reportText.trim()) return;
    setReportSaving(true); setReportSaved(false);
    try {
      const dateKey = format(new Date(), 'yyyy-MM-dd');
      await setDoc(doc(db, 'users', profile.id, 'dailyReports', dateKey), {
        date: dateKey, authorId: profile.id, authorName: profile.name,
        report: reportText.trim(), updatedAt: new Date().toISOString(),
        snapshot: { urgentTasksCount, todayMeetingsCount, inboxItemsCount, followUpsDueCount, followUpsWaitingCount, paymentsAwaitingCount }
      }, { merge: true });
      setReportSaved(true);
    } catch (e) { console.error('Failed to save daily report:', e); }
    finally { setReportSaving(false); }
  };

  
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white tracking-tight">{greeting}</h2>
        <p className="text-slate-400">Welcome to your Operations Hub.</p>
      </div>

      {/* Daily operations briefing */}
      <section className="mb-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-bold mb-2">Shawn's Daily Briefing</p>
            <h3 className="text-xl font-bold text-white">Here's what needs your attention.</h3>
            <p className="text-sm text-slate-400 mt-1">
              {urgentTasksCount} urgent task{urgentTasksCount !== 1 ? 's' : ''}, {followUpsDueCount} follow-up{followUpsDueCount !== 1 ? 's' : ''} due, {todayMeetingsCount} meeting{todayMeetingsCount !== 1 ? 's' : ''} today
              {followUpsWaitingCount > 0 ? `, and ${followUpsWaitingCount} item${followUpsWaitingCount !== 1 ? 's' : ''} waiting on someone else.` : '.'}
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('shawn:open', { detail: { mode: 'chat', context: 'workspace' } }))}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-accent text-slate-950 font-bold text-sm shrink-0"
          >
            Ask Shawn
          </button>
        </div>
      </section>

      {/* Circular Progress Indicators Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        {/* Gauge 1: Task Completion Rate */}
        {(() => {
          const taskPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
          const radius = 38;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (taskPct / 100) * circumference;

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Task Completion
                </span>
                <h4 className="text-2xl font-extrabold text-white tracking-tight">{taskPct}%</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {completedTasksCount} of {totalTasksCount} tasks done
                </p>
              </div>
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="text-slate-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="text-teal-400 transition-all duration-1000 ease-out"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-teal-300">{taskPct}%</span>
              </div>
            </div>
          );
        })()}

        {/* Gauge 2: Active Projects Health */}
        {(() => {
          const projPct = totalProjectsCount > 0 ? Math.round((activeProjectsCount / totalProjectsCount) * 100) : 100;
          const radius = 38;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (projPct / 100) * circumference;

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Active Projects
                </span>
                <h4 className="text-2xl font-extrabold text-white tracking-tight">{activeProjectsCount}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {activeProjectsCount} active • {totalProjectsCount} total
                </p>
              </div>
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="text-slate-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="text-blue-400 transition-all duration-1000 ease-out"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-blue-300">{activeProjectsCount}</span>
              </div>
            </div>
          );
        })()}

        {/* Gauge 3: Deadline & Schedule Reliability */}
        {(() => {
          const reliabilityPct = tasksOverdueCount === 0 ? 100 : Math.max(10, 100 - tasksOverdueCount * 25);
          const radius = 38;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (reliabilityPct / 100) * circumference;

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Schedule Health
                </span>
                <h4 className="text-2xl font-extrabold text-white tracking-tight">{reliabilityPct}%</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {tasksOverdueCount === 0 ? '0 overdue deadlines' : `${tasksOverdueCount} overdue item(s)`}
                </p>
              </div>
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className="text-slate-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    className={`${
                      tasksOverdueCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                    } transition-all duration-1000 ease-out`}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <span
                  className={`absolute text-xs font-bold ${
                    tasksOverdueCount > 0 ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {reliabilityPct}%
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Today's Focus */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Today's Focus</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors cursor-pointer">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span className="font-medium">{urgentTasksCount} Urgent Tasks</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors cursor-pointer">
              <CalendarIcon className="w-5 h-5 text-accent" />
              <span className="font-medium">{todayMeetingsCount} Meeting{todayMeetingsCount !== 1 ? 's' : ''} Today</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors cursor-pointer">
              <Users className="w-5 h-5 text-accent" />
              <span className="font-medium">{clientsWaitingCount} Client{clientsWaitingCount !== 1 ? 's' : ''} Waiting</span>
            </div>
            <Link to="/follow-ups" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
              <Clock3 className="w-5 h-5 text-accent" />
              <span className="font-medium">{followUpsDueCount} Follow-up{followUpsDueCount !== 1 ? 's' : ''} Due</span>
            </Link>
            <Link to="/inbox" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
              <Inbox className="w-5 h-5 text-accent" />
              <span className="font-medium">{inboxItemsCount} Inbox Item{inboxItemsCount !== 1 ? 's' : ''}</span>
            </Link>
            <Link to="/follow-ups" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
              <Clock className="w-5 h-5 text-accent" />
              <span className="font-medium">{followUpsWaitingCount} Waiting on Someone</span>
            </Link>
            <Link to="/documents" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
              <FileText className="w-5 h-5 text-accent" />
              <span className="font-medium">{documentsAttentionCount} Documents Need Attention</span>
            </Link>
            <div className="flex items-center gap-3 text-slate-300">
              <Clock className="w-5 h-5 text-accent" />
              <span className="font-medium">{paymentsAwaitingCount} Payments Awaiting Confirmation</span>
            </Link>
          </div>
        </section>

        {/* Business Health */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Business Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Tasks Overdue</span>
              <span className={cn("text-sm font-bold", tasksOverdueCount > 0 ? "text-red-400" : "text-emerald-400")}>
                {tasksOverdueCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Meetings This Week</span>
              <span className="text-sm font-bold text-slate-200">{meetingsThisWeekCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Documents Pending Review</span>
              <span className="text-sm font-bold text-slate-200">{documentsAttentionCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Team Availability</span>
              <span className="text-sm font-bold text-emerald-400">Normal</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div><h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">This Week</h3><p className="text-sm text-slate-400 mt-1">Your operating picture for the current week.</p></div>
            <Link to="/calendar" className="text-xs font-bold text-accent">Open calendar →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Tasks due', weekTasksCount], ['Meetings', meetingsThisWeekCount], ['Follow-ups due', followUpsDueCount], ['Waiting', followUpsWaitingCount]].map(([label,value]) => (
              <div key={label as string} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="text-2xl font-bold text-white">{value}</div><div className="text-xs text-slate-500 mt-1">{label}</div></div>
            ))}
          </div>
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">End-of-Day Report</h3>
          <p className="text-sm text-slate-400 mb-4">Record what was completed, what is pending, and what needs your decision.</p>
          <textarea value={reportText} onChange={e=>{setReportText(e.target.value);setReportSaved(false)}} placeholder="Completed…\nPending…\nNeeds your decision…\nTomorrow…" className="w-full min-h-[120px] rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200 outline-none focus:border-accent resize-y" />
          <div className="flex items-center justify-between mt-3"><span className="text-xs text-slate-500">Saved privately to your daily reports.</span><button onClick={saveDailyReport} disabled={reportSaving || !reportText.trim()} className="px-4 py-2 rounded-lg bg-accent text-slate-950 text-sm font-bold disabled:opacity-50">{reportSaving ? 'Saving…' : reportSaved ? 'Saved ✓' : 'Save report'}</button></div>
        </section>
      </div>

      {/* Third row: Scratchpad & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8">
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Recent Activity
            </h3>
            
            {recentActivity.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
                No recent activity recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(log => (
                  <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium text-white">{log.userId}</span> {log.action} <span className="font-medium text-white">{log.details}</span>
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{log.entityType}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {safeFormat(log.createdAt, 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="md:col-span-4">
          <section className="h-full flex flex-col min-h-[300px]">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Personal Scratchpad
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-5 relative overflow-hidden flex-1"> 
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
          </section>
        </div>
      </div>

    </div>
  );
}
