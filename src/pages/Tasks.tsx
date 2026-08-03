import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task } from '../types';
import { Loader2, Plus, Filter, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { addDoc } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';

export function Tasks() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskClient, setNewTaskClient] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [clientsList, setClientsList] = useState<{id: string, name: string}[]>([]);
  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);
  const [newTaskProject, setNewTaskProject] = useState('');

  const { users } = useUsers();

  useEffect(() => {
    if (!user || !profile) return;
    
    setLoading(true);
    let q;
    if (profile.role === 'admin' || profile.role === 'assistant') {
      q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'tasks'), where('assignedTo', '==', profile.id));
    }
    
    
    const fetchClients = async () => {
      const { getDocs, collection } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'clients'));
      setClientsList(snap.docs.map(d => ({id: d.id, name: d.data().name})));
    };
    fetchClients();
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Task));
      if (profile.role !== 'admin' && profile.role !== 'assistant') {
        data = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      setTasks(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile]);

  
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !profile) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        status: 'pending',
        assignedTo: newTaskAssignee || profile.id,
        createdBy: profile.id,
        clientId: newTaskClient || null,
        projectId: newTaskProject || null,
        deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null,
        checklist: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsDialogOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('medium');
      setNewTaskClient('');
      setNewTaskProject('');
      setNewTaskAssignee('');
      setNewTaskDeadline('');
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active' && (t.status === 'completed' || t.status === 'archived')) return false;
    if (filter === 'completed' && t.status !== 'completed') return false;
    if (filter === 'archived' && t.status !== 'archived') return false;
    if (filter === 'all' && t.status === 'archived') return false; // Hide archived from 'All Tasks' by default
    
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
            <option value="archived">Archived</option>
          </select>
          
          <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Task</span>
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
              <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl z-50 focus:outline-none max-h-[90vh] overflow-y-auto">
                <Dialog.Title className="text-xl font-bold text-white mb-4">Create New Task</Dialog.Title>
                <Dialog.Close className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </Dialog.Close>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                    <input type="text" required value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                    <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent min-h-[80px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
                      <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Deadline</label>
                      <input type="date" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Assign To</label>
                    <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                      <option value="">Self</option>
                      {Object.values(users).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Related Client (Optional)</label>
                    <select value={newTaskClient} onChange={e => setNewTaskClient(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                      <option value="">None</option>
                      {clientsList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors mt-6">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
                  </button>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
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
                <div key={task.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        task.status === 'under_review' ? 'bg-purple-500/10 text-purple-400' :
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
                          {users[task.assignedTo] ? (
      <span className="flex items-center gap-1.5">
        {users[task.assignedTo].photoUrl ? (
          <img src={users[task.assignedTo].photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{users[task.assignedTo].name.charAt(0)}</span>
        )}
        {users[task.assignedTo].name}
      </span>
    ) : 'Unassigned'}
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
                  <div className="w-full sm:w-auto flex justify-end mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-800 sm:border-0">
<Link to={`/tasks/${task.id}`} className="text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                    View
                  </Link>
</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
