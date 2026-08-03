import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, where, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task, Meeting } from '../types';
import { Link } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CheckSquare, X } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns';
import * as Popover from '@radix-ui/react-popover';

export function Calendar() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [formType, setFormType] = useState<'task' | 'meeting' | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);

    const tasksQuery = profile.role === 'admin' || profile.role === 'assistant'
      ? query(collection(db, 'tasks'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
      
    const meetingsQuery = query(collection(db, 'meetings'));

    let tasksLoaded = false;
    let meetingsLoaded = false;

    const checkLoading = () => {
      if (tasksLoaded && meetingsLoaded) setLoading(false);
    };

    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      tasksLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error fetching tasks:", error);
      tasksLoaded = true;
      checkLoading();
    });

    const unsubMeetings = onSnapshot(meetingsQuery, (snap) => {
      setMeetings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting)));
      meetingsLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error fetching meetings:", error);
      meetingsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubTasks();
      unsubMeetings();
    };
  }, [profile]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const days = eachDayOfInterval({
    start: monthStart,
    end: monthEnd
  });

  const handleCreate = async () => {
    if (!selectedDay || !title.trim() || !profile) return;
    setIsSubmitting(true);
    try {
      if (formType === 'task') {
        // time defaults to end of day if not changed, but here we just use the selected date
        const deadline = new Date(selectedDay);
        // if user wants specific time, we can parse it, but standard date input for tasks
        await addDoc(collection(db, 'tasks'), {
          title,
          description: '',
          priority: 'medium',
          status: 'pending',
          assignedTo: profile.id,
          createdBy: profile.id,
          deadline: deadline.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else if (formType === 'meeting') {
        const [hours, minutes] = time.split(':').map(Number);
        const meetingDate = new Date(selectedDay);
        meetingDate.setHours(hours, minutes, 0, 0);
        
        await addDoc(collection(db, 'meetings'), {
          notesRaw: title,
          date: meetingDate.toISOString(),
          attendees: [],
          actionPoints: [],
          generatedDocs: [],
          ownerId: profile.id,
          createdAt: new Date().toISOString()
        });
      }
      
      // await  // now using onSnapshot
      setSelectedDay(null);
      setFormType(null);
      setTitle('');
    } catch (err) {
      console.error(err);
      console.log('Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openForm = (type: 'task' | 'meeting') => {
    setFormType(type);
    setTitle('');
    setTime('09:00');
  };

  if (loading && tasks.length === 0) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 flex flex-col h-full min-h-0 pb-20 md:pb-0 relative">
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

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 flex-1 relative">
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
            
            const isSelected = selectedDay && isSameDay(selectedDay, day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <Popover.Root 
                key={day.toISOString()} 
                open={isSelected || false} 
                onOpenChange={(open) => {
                  if (open) {
                    setSelectedDay(day);
                    setFormType(null);
                  } else {
                    setSelectedDay(null);
                  }
                }}
              >
                <Popover.Trigger asChild>
                  <button 
                    className={`p-3 transition-colors hover:bg-slate-800/50 flex flex-col items-stretch text-left h-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent ${
                      !isSameMonth(day, currentDate) ? 'bg-slate-950/30 opacity-50' : ''
                    } ${isToday ? 'bg-accent/5' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-lg ${
                        isToday ? 'bg-accent text-slate-950 ring-2 ring-accent ring-offset-2 ring-offset-slate-900' : 'text-slate-400'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      
                      {/* Indicators for density */}
                      <div className="flex gap-1 mt-1">
                        {dayTasks.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        {dayMeetings.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                      {dayMeetings.map(m => (
                        <div key={m.id} className={`text-[10px] px-2 py-1 border rounded font-semibold truncate ${
                          m.status === 'in_session' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          m.status === 'canceled' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          m.status === 'rescheduled' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'bg-slate-800/50 text-slate-400 border-slate-700/50'
                        }`}>
                          {format(parseISO(m.date), 'HH:mm')} {(m.status || 'Scheduled').replace('_', ' ')}
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
                  </button>
                </Popover.Trigger>

                <Popover.Portal>
                  <Popover.Content 
                    side="right" 
                    align="start" 
                    sideOffset={10} 
                    collisionPadding={20}
                    className="z-50 w-[calc(100vw-32px)] sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 outline-none max-sm:!fixed max-sm:!bottom-4 max-sm:!top-auto max-sm:!left-4 max-sm:!right-4 max-sm:!transform-none max-sm:!w-auto"
                  >
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                      <h3 className="font-bold text-white">
                        {format(day, 'EEEE, MMMM d')}
                      </h3>
                      <Popover.Close className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </Popover.Close>
                    </div>

                    <div className="p-4 max-h-[60vh] overflow-y-auto">
                      {!formType ? (
                        <div className="space-y-4">
                          {dayTasks.length > 0 || dayMeetings.length > 0 ? (
                            <div className="space-y-2 mb-4">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Existing Items</h4>
                              {dayMeetings.map(m => (
                                <Link to={`/meetings/${m.id}`} key={m.id} className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <CalendarIcon className={`w-4 h-4 shrink-0 ${
                                      m.status === 'in_session' ? 'text-blue-400' :
                                      m.status === 'completed' ? 'text-emerald-400' :
                                      m.status === 'canceled' ? 'text-red-400' :
                                      m.status === 'rescheduled' ? 'text-purple-400' :
                                      'text-slate-400'
                                    }`} />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-200 truncate">{m.notesRaw.split('\n')[0] || 'Meeting'}</p>
                                      <p className="text-xs text-slate-400">{format(parseISO(m.date), 'h:mm a')}</p>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] w-fit font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                    m.status === 'in_session' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    m.status === 'canceled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                    m.status === 'rescheduled' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                  }`}>
                                    {(m.status || 'scheduled').replace('_', ' ')}
                                  </span>
                                </Link>
                              ))}
                              {dayTasks.map(t => (
                                <Link to={`/tasks/${t.id}`} key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors">
                                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">{t.title}</p>
                                    <p className="text-xs text-slate-400">{t.status.replace('_', ' ')}</p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 text-center py-4">No items scheduled for this date.</p>
                          )}

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                            <button 
                              onClick={() => openForm('task')}
                              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm"
                            >
                              <Plus className="w-4 h-4 text-accent" /> Task
                            </button>
                            <button 
                              onClick={() => openForm('meeting')}
                              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm"
                            >
                              <Plus className="w-4 h-4 text-blue-400" /> Meeting
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setFormType(null)} className="text-slate-400 hover:text-white p-1 -ml-1">
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                              New {formType === 'task' ? 'Task' : 'Meeting'}
                            </h4>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              {formType === 'task' ? 'Task Title' : 'Meeting Title'}
                            </label>
                            <input 
                              type="text"
                              value={title}
                              onChange={e => setTitle(e.target.value)}
                              placeholder={formType === 'task' ? "e.g. Review Q3 Report" : "e.g. Sync with Design Team"}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent"
                              autoFocus
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
                              <input 
                                type="date"
                                value={format(selectedDay, 'yyyy-MM-dd')}
                                onChange={e => {
                                  const newDate = parseISO(e.target.value);
                                  if (!isNaN(newDate.getTime())) {
                                    setSelectedDay(newDate);
                                  }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent [color-scheme:dark]"
                              />
                            </div>
                            
                            {formType === 'meeting' && (
                              <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Time</label>
                                <input 
                                  type="time"
                                  value={time}
                                  onChange={e => setTime(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent [color-scheme:dark]"
                                />
                              </div>
                            )}
                          </div>

                          <button 
                            onClick={handleCreate}
                            disabled={!title.trim() || isSubmitting}
                            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm mt-4"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Create {formType === 'task' ? 'Task' : 'Meeting'}
                          </button>
                        </div>
                      )}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            );
          })}
        </div>
      </div>
    </div>
  );
}
