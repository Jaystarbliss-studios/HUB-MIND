import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { RecurringMeetingTemplate } from '../types';
import { CalendarClock, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { recurringMeetingSummary } from '../lib/recurringMeetings';

const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fullDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function RecurringSchedulePanel() {
  const { profile } = useAuth();
  const [items, setItems] = useState<RecurringMeetingTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<RecurringMeetingTemplate['type']>('class');
  const [frequency, setFrequency] = useState<RecurringMeetingTemplate['frequency']>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, 'recurringMeetingTemplates'), snap => {
      setItems(snap.docs.map(d => ({id:d.id, ...d.data()} as RecurringMeetingTemplate)).filter(x => x.ownerId === profile.id));
    }, e => console.warn('Recurring schedule:', e));
  }, [profile]);

  const reset = () => {
    setTitle(''); setType('class'); setFrequency('weekly'); setSelectedDays([1]);
    setStartTime('09:00'); setEndTime('10:00'); setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(''); setLocation(''); setDescription('');
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !title.trim() || (frequency === 'weekly' && selectedDays.length === 0)) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'recurringMeetingTemplates'), {
        title: title.trim(), type, frequency,
        daysOfWeek: frequency === 'weekly' ? selectedDays : [],
        dayOfMonth: frequency === 'monthly' ? Number(startDate.slice(8,10)) : undefined,
        startTime, endTime, startDate, endDate: endDate || null,
        location: location.trim() || null, description: description.trim() || null,
        ownerId: profile.id, attendees: [], active: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      reset(); setOpen(false);
    } catch (e) { console.error('Create recurring schedule failed:', e); }
    finally { setSaving(false); }
  };

  const toggleDay = (day: number) => setSelectedDays(v => v.includes(day) ? v.filter(x => x !== day) : [...v, day].sort());

  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
    <div className="flex flex-col sm:flex-row justify-between gap-3">
      <div className="flex gap-3 items-center">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400"><CalendarClock className="w-5 h-5"/></div>
        <div><h2 className="font-bold text-white text-sm">Recurring Schedule</h2><p className="text-xs text-slate-500">Classes, meetings and appointments that repeat automatically.</p></div>
      </div>
      <button onClick={()=>setOpen(true)} className="px-3 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"><Plus className="w-4 h-4"/> Add recurring event</button>
    </div>
    {items.length > 0 && <div className="mt-4 grid md:grid-cols-2 gap-2">
      {items.map(x=><div key={x.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-200 truncate">{x.title}</p><p className="text-xs text-cyan-400 mt-0.5">{recurringMeetingSummary(x)} · {x.startTime}{x.endTime ? `–${x.endTime}` : ''}</p><p className="text-[11px] text-slate-500 mt-1 capitalize">{x.type.replace('_',' ')}{x.location ? ` · ${x.location}` : ''}</p></div>
        <button onClick={async()=>{if(confirm('Stop this recurring event? Existing occurrences remain.')) await deleteDoc(doc(db,'recurringMeetingTemplates',x.id));}} className="p-2 text-slate-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4"/></button>
      </div>)}
    </div>}
    {open && <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={create} className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between"><div><h3 className="text-lg font-bold text-white">Add recurring event</h3><p className="text-xs text-slate-500">Set it once; Hub-Mind keeps your calendar populated.</p></div><button type="button" onClick={()=>{reset();setOpen(false)}} className="text-slate-500 hover:text-white"><X/></button></div>
        <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. JDI Music Class" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"/>
        <div className="grid grid-cols-2 gap-3">
          <select value={type} onChange={e=>setType(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"><option value="class">Class</option><option value="meeting">Meeting</option><option value="appointment">Appointment</option><option value="school_event">School event</option><option value="other">Other</option></select>
          <select value={frequency} onChange={e=>setFrequency(e.target.value as any)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"><option value="weekly">Every week</option><option value="daily">Every day</option><option value="monthly">Every month</option></select>
        </div>
        {frequency==='weekly' && <div><label className="text-xs font-medium text-slate-400 block mb-2">Repeats on</label><div className="grid grid-cols-7 gap-1.5">{days.map((d,i)=><button type="button" key={d} onClick={()=>toggleDay(i)} className={`rounded-lg py-2 text-xs font-bold border ${selectedDays.includes(i)?'bg-teal-500 text-slate-950 border-teal-400':'bg-slate-950 text-slate-500 border-slate-800'}`}>{d}</button>)}</div><p className="text-[11px] text-slate-500 mt-2">{selectedDays.length ? selectedDays.map(i=>fullDays[i]).join(', ') : 'Select at least one day'}</p></div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400 block mb-1">Start time</label><input required type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white [color-scheme:dark]"/></div>
          <div><label className="text-xs text-slate-400 block mb-1">End time</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white [color-scheme:dark]"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400 block mb-1">Starts</label><input required type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white [color-scheme:dark]"/></div>
          <div><label className="text-xs text-slate-400 block mb-1">Ends (optional)</label><input type="date" value={endDate} min={startDate} onChange={e=>setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white [color-scheme:dark]"/></div>
        </div>
        <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location or meeting room (optional)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"/>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Notes (optional)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white min-h-20"/>
        <button disabled={saving || (frequency==='weekly' && selectedDays.length===0)} className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm">{saving?'Saving…':'Create recurring event'}</button>
      </form>
    </div>}
  </section>;
}
