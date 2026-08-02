import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task } from '../types';
import { Loader2, ArrowLeft, Trash2, CheckCircle2, Clock, Calendar as CalendarIcon, Tag, AlignLeft, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';

export function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { users } = useUsers();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchTask = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'tasks', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTask({ id: docSnap.id, ...docSnap.data() } as Task);
        } else {
          console.error("Task not found");
        }
      } catch (error) {
        console.error("Error fetching task:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [id]);

  const handleDelete = async () => {
    
    if (!id) return; setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'tasks', id));
      navigate('/tasks');
    } catch (error) {
      console.error("Error deleting task:", error);
      console.log("alert removed");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async () => {
    if (!id || !task) return;
    setIsUpdating(true);
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      await updateDoc(doc(db, 'tasks', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setTask({ ...task, status: newStatus });
    } catch (error) {
      console.error("Error updating task status:", error);
      console.log("alert removed");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  if (!task) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-slate-200 font-bold mb-4">Task not found</h2>
        <button onClick={() => navigate('/tasks')} className="text-accent hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleStatus}
            disabled={isUpdating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              task.status === 'completed' 
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
          >
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {task.status === 'completed' ? 'Mark as Pending' : 'Mark as Completed'}
          </button>
          
          {(profile?.role === 'admin' || profile?.role === 'assistant') && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg font-semibold transition-colors text-sm"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
              task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
              task.status === 'waiting_review' ? 'bg-purple-500/10 text-purple-400' :
              task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
              'bg-slate-800 text-slate-400'
            }`}>
              {task.status.replace('_', ' ')}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
              task.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
              task.priority === 'high' ? 'bg-accent/10 text-accent border border-accent/20' :
              'bg-slate-800 text-slate-400'
            }`}>
              {task.priority} Priority
            </span>
          </div>
          
          <h1 className="text-3xl font-bold text-white tracking-tight">{task.title}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y border-slate-800">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Deadline</p>
              <p className="text-sm text-slate-200">
                {task.deadline ? format(parseISO(task.deadline), 'MMMM d, yyyy') : 'No deadline'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Assigned To</p>
              <div className="text-sm text-slate-200 flex items-center gap-2 mt-0.5">
                {task.assignedTo && users[task.assignedTo] ? (
                  <span className="flex items-center gap-1.5">
                    {users[task.assignedTo].photoUrl ? (
                      <img src={users[task.assignedTo].photoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">
                        {users[task.assignedTo].name.charAt(0)}
                      </span>
                    )}
                    {users[task.assignedTo].name}
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
            <AlignLeft className="w-5 h-5 text-slate-500" />
            <h3>Description</h3>
          </div>
          <div className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 min-h-[100px]">
            {task.description || <span className="text-slate-500 italic">No description provided.</span>}
          </div>
        </div>

        {task.checklist && task.checklist.length > 0 && (
          <div>
            <h3 className="text-slate-200 font-semibold mb-3">Checklist</h3>
            <div className="space-y-2">
              {task.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-950/50 border border-slate-800/50 rounded-lg">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${item.done ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-slate-600 bg-slate-800 text-transparent'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-sm ${item.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
