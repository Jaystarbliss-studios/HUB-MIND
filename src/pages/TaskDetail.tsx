import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task } from '../types';
import { Loader2, ArrowLeft, Trash2, CheckCircle2, Clock, Calendar as CalendarIcon, Tag, AlignLeft, User, Edit, MessageSquare, Send } from 'lucide-react';
import { safeParseISO, safeFormat } from "../lib/dateUtils";
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';
import { VoiceDictation } from '../components/VoiceDictation';
import { Share2 } from 'lucide-react';
import { shareHubMindItem, copyShareUrl } from '../lib/shareLinks';

export function TaskDetail() {
  const { id } = useParams();
  const isSharedView = new URLSearchParams(window.location.search).get('shared') === '1';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { users } = useUsers();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<any>('medium');
  const [editDeadline, setEditDeadline] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);
  const [clientsList, setClientsList] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!id) return;
    const fetchTask = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'tasks', id);
        const docSnap = await getDoc(docRef);
        const { getDocs, collection } = await import('firebase/firestore');
        const pSnap = await getDocs(collection(db, 'projects'));
        const cSnap = await getDocs(collection(db, 'clients'));
        setProjectsList(pSnap.docs.map(d => ({id: d.id, name: d.data().name})));
        setClientsList(cSnap.docs.map(d => ({id: d.id, name: d.data().name})));
        if (docSnap.exists()) {
          const t = { id: docSnap.id, ...docSnap.data() } as Task;
          setTask(t);
          setEditTitle(t.title);
          setEditDesc(t.description || '');
          setEditPriority(t.priority);
          setEditDeadline(t.deadline ? t.deadline.substring(0, 10) : '');
          setEditAssignedTo(t.assignedTo || '');
          setEditProjectId(t.projectId || '');
          setEditClientId(t.clientId || '');
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

  
  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !task) return;
    setIsUpdating(true);
    try {
      const updates: any = {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
        assignedTo: editAssignedTo,
        projectId: editProjectId || null,
        clientId: editClientId || null,
        updatedAt: new Date().toISOString()
      };
      if (editDeadline) {
        updates.deadline = new Date(editDeadline).toISOString();
      } else {
        updates.deadline = null;
      }
      await updateDoc(doc(db, 'tasks', id), updates);
      setTask({ ...task, ...updates });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating task:", error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDelete = async () => {
    
    if (!id) return; setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'tasks', id));
      navigate('/tasks');
    } catch (error) {
      console.error("Error deleting task:", error);
      
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!id || !task) return;
    setIsUpdating(true);
    try {
      const newStatus = e.target.value as any;
      await updateDoc(doc(db, 'tasks', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setTask({ ...task, status: newStatus });
    } catch (error) {
      console.error("Error updating task status:", error);
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
        <div className="flex items-center gap-2 sm:gap-3">
          
          <button
            onClick={async () => {
              const path = `/tasks/${task.id}?shared=1`;
              try { await copyShareUrl(path); } catch {}
              shareHubMindItem(path, task.title);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 rounded-lg font-semibold transition-colors text-sm"
            title="Share this task"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <select
            value={task.status}
            onChange={handleStatusChange}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm border focus:outline-none focus:ring-2 focus:ring-accent ${
              task.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : task.status === 'under_review'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : task.status === 'in_progress'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="under_review">Under Review</option>
            {(profile?.role === 'admin' || profile?.role === 'assistant') && (
              <>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </>
            )}
          </select>

          
          
          {!isSharedView && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-semibold transition-colors text-sm border border-slate-700">
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
  
          {!isSharedView && (
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

      
      {!isSharedView && isEditing ? (
        <form onSubmit={handleUpdateDetails} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Edit Task Details</h2>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
            <input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-400">Description</label>
              <VoiceDictation
                onTranscript={(text) => setEditDesc((prev) => (prev ? `${prev} ${text}` : text))}
                size="sm"
              />
            </div>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
              <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Deadline</label>
              <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Assigned To</label>
              <select value={editAssignedTo} onChange={e => setEditAssignedTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                <option value="">Unassigned</option>
                {Object.values(users).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Related Project</label>
              <select value={editProjectId} onChange={e => setEditProjectId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                <option value="">None</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Related Client</label>
              <select value={editClientId} onChange={e => setEditClientId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                <option value="">None</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
  
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-400 hover:text-white font-semibold">Cancel</button>
            <button type="submit" disabled={isUpdating} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 px-4 py-2 rounded-lg font-bold transition-colors">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">
  
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
              task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
              task.status === 'under_review' ? 'bg-purple-500/10 text-purple-400' :
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
                {task.deadline ? safeFormat(task.deadline, 'MMMM d, yyyy') : 'No deadline'}
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
                    {(item as any).title || (item as any).item || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task Notes & Voice Dictation Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              <span>Task Progress Notes & Comments</span>
            </div>
            <VoiceDictation
              onTranscript={async (voiceNote) => {
                if (!id || !task || !profile) return;
                const newComment = {
                  userId: profile.id,
                  text: voiceNote,
                  timestamp: new Date().toISOString()
                };
                const updatedComments = [...(task.comments || []), newComment];
                try {
                  await updateDoc(doc(db, 'tasks', id), { comments: updatedComments });
                  setTask({ ...task, comments: updatedComments });
                } catch (e) {
                  console.warn('Failed to add voice comment', e);
                }
              }}
              placeholder="Speak note to add..."
              size="sm"
            />
          </div>

          <div className="space-y-2">
            {task.comments && task.comments.length > 0 ? (
              task.comments.map((c, i) => (
                <div key={i} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">{users[c.userId]?.name || 'User'}</span>
                    <span>{safeFormat(c.timestamp, 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-slate-200 text-sm">{c.text}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No notes recorded yet. Use the Dictate button above to capture voice notes.</p>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
