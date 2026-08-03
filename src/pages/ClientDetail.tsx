import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Client, Task, Meeting } from '../types';
import { Loader2, ArrowLeft, Mail, Phone, Building2, User, Users as UsersIcon, Calendar as CalendarIcon, CheckSquare, Edit, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';
import { getThumbnailUrl } from '../lib/cloudinary';

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { users } = useUsers();
  
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'clients', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setClient({ id: docSnap.id, ...docSnap.data() } as Client);
        }
        
        // Fetch tasks
        const tasksQ = query(collection(db, 'tasks'), where('clientId', '==', id));
        const tasksSnap = await getDocs(tasksQ);
        const t = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasks(t.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        
        // Fetch meetings
        const meetingsQ = query(collection(db, 'meetings'), where('clientId', '==', id));
        const meetingsSnap = await getDocs(meetingsQ);
        const m = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
        setMeetings(m.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
      } catch (error) {
        console.error("Error fetching client details:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  const getClientIcon = (type: string) => {
    switch (type) {
      case 'school': return <Building2 className="w-8 h-8 text-indigo-400" />;
      case 'parent': return <User className="w-8 h-8 text-emerald-400" />;
      default: return <UsersIcon className="w-8 h-8 text-slate-400" />;
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-slate-200 font-bold mb-4">Client not found</h2>
        <button onClick={() => navigate('/clients')} className="text-accent hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shrink-0">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {client.photoUrl ? (
            <img src={getThumbnailUrl(client.photoUrl, 128, 128)} alt="" className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border border-slate-700" />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
              {getClientIcon(client.type)}
            </div>
          )}
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-1 rounded">{client.type}</span>
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                  client.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  client.status === 'lead' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-400'
                }`}>{client.status}</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{client.name}</h1>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 text-sm text-slate-300">
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <a href={`mailto:${client.email}`} className="hover:text-accent transition-colors">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <a href={`tel:${client.phone}`} className="hover:text-accent transition-colors">{client.phone}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pb-4">
        {/* Tasks Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-accent" />
              Related Tasks
            </h2>
            <span className="text-xs font-semibold bg-slate-800 text-slate-400 px-2 py-1 rounded">{tasks.length}</span>
          </div>
          <div className="p-2 overflow-y-auto flex-1">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No tasks for this client.</div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <Link key={task.id} to={`/tasks/${task.id}`} className="block p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                        task.status === 'under_review' ? 'bg-purple-500/10 text-purple-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      {task.deadline && <span className="text-xs text-slate-500">{format(parseISO(task.deadline), 'MMM d, yyyy')}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">{task.title}</h3>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meetings Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-400" />
              Meetings
            </h2>
            <span className="text-xs font-semibold bg-slate-800 text-slate-400 px-2 py-1 rounded">{meetings.length}</span>
          </div>
          <div className="p-2 overflow-y-auto flex-1">
            {meetings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No meetings scheduled.</div>
            ) : (
              <div className="space-y-2">
                {meetings.map(meeting => (
                  <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="block p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        meeting.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        meeting.status === 'in_session' ? 'bg-blue-500/10 text-blue-400' :
                        meeting.status === 'canceled' ? 'bg-red-500/10 text-red-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {(meeting.status || 'scheduled').replace('_', ' ')}
                      </span>
                      {meeting.date && <span className="text-xs text-slate-500">{format(parseISO(meeting.date), 'MMM d, h:mm a')}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">{meeting.notesRaw.split('\\n')[0] || 'Meeting'}</h3>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
