import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task } from '../types';
import { Loader2, Plus, Filter, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';

export function Tasks() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [searchQuery, setSearchQuery] = useState('');
  const { users } = useUsers();

  useEffect(() => {
    if (!user || !profile) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        let q;
        if (profile.role === 'admin' || profile.role === 'assistant') {
          q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        } else {
          q = query(collection(db, 'tasks'), where('assignedTo', '==', user.uid), orderBy('createdAt', 'desc'));
        }
        
        const snapshot = await getDocs(q);
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Task)));
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user, profile]);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active' && (t.status === 'completed' || t.status === 'archived')) return false;
    if (filter === 'completed' && t.status !== 'completed') return false;
    if (searchQuery && !(t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) && !(t.description || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tasks</h1>
          <p className="text-sm text-slate-400">Manage your action items</p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent"
          >
            <option value="all">All Tasks</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-sm flex-1">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No tasks found.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 overflow-y-auto">
              {filteredTasks.map(task => (
                <div key={task.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        task.status === 'waiting_review' ? 'bg-purple-500/10 text-purple-400' :
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        task.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        task.priority === 'high' ? 'bg-accent/10 text-accent border border-accent/20' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {task.priority}
                      </span>
                      {task.assignedTo && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider bg-slate-800 text-slate-400 ml-auto md:ml-0 border border-slate-700">
                          {users[task.assignedTo] || 'Unassigned'}
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-slate-200 truncate pr-4">{task.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      {task.deadline && (
                        <span>Due {format(parseISO(task.deadline), 'MMM d')}</span>
                      )}
                      <span className="hidden sm:inline">{task.checklist?.filter(c => c.done).length || 0}/{task.checklist?.length || 0} checks</span>
                    </div>
                  </div>
                  <Link 
                    to={`/tasks/${task.id}`}
                    className="text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
