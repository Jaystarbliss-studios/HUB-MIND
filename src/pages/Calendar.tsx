import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task, Meeting } from '../types';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, startOfDay } from 'date-fns';

export function Calendar() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const tasksQuery = profile.role === 'admin' || profile.role === 'assistant'
          ? query(collection(db, 'tasks'))
          : query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
          
        const meetingsQuery = query(collection(db, 'meetings'));

        const [tasksSnap, meetingsSnap] = await Promise.all([
          getDocs(tasksQuery),
          getDocs(meetingsQuery)
        ]);
        
        setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setMeetings(meetingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting)));
      } catch (error) {
        console.error("Error fetching calendar data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const days = eachDayOfInterval({
    start: monthStart,
    end: monthEnd
  });

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Calendar</h1>
          <p className="text-sm text-slate-400">Deadlines and meetings</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-white min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-800/20 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        
        {/* Grid offset for first day */}
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)] divide-y divide-x divide-slate-800 overflow-y-auto flex-1">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-950/30" />
          ))}
          
          {days.map(day => {
            const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));
            const dayMeetings = meetings.filter(m => m.date && isSameDay(parseISO(m.date), day));
            
            return (
              <div key={day.toISOString()} className={`p-3 transition-colors hover:bg-slate-800/30 flex flex-col ${
                !isSameMonth(day, currentDate) ? 'bg-slate-950/30 opacity-50' : ''
              } ${isSameDay(day, new Date()) ? 'bg-accent/5' : ''}`}>
                <div className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-lg mb-2 ${
                  isSameDay(day, new Date()) ? 'bg-accent text-slate-950' : 'text-slate-400'
                }`}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {dayMeetings.map(m => (
                    <div key={m.id} className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-semibold truncate">
                      {format(parseISO(m.date), 'HH:mm')} Meeting
                    </div>
                  ))}
                  {dayTasks.map(t => (
                    <div key={t.id} className={`text-[10px] px-2 py-1 border rounded font-semibold truncate ${
                      t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      t.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      t.priority === 'high' ? 'bg-accent/10 text-accent border-accent/20' :
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
