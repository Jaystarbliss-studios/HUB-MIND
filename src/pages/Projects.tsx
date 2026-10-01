import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { Project, Task, Client } from '../types';
import { getLocalProjects, setLocalProjects, upsertLocalProject, deleteLocalProject } from '../lib/localWorkspaceStore';
import { createProject, deleteProject } from '../services/projectService';
import { Loader2, Plus, Folder, Search, LayoutGrid, CalendarRange, Trash2, AlertCircle, Check } from 'lucide-react';
import { safeFormat } from "../lib/dateUtils";
import { Link } from 'react-router-dom';
import { ProjectTimelineView } from '../components/ProjectTimelineView';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Projects() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>(() => getLocalProjects());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!profile) return;

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      if (snap.docs.length > 0) {
        const pData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        pData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setLocalProjects(pData);
        setProjects(pData);
      } else {
        setProjects(getLocalProjects());
      }
      setLoading(false);
    }, (err) => {
      console.warn("Error subscribing to projects, using local storage fallback:", err);
      setProjects(getLocalProjects());
      setLoading(false);
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snap) => {
      const tData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(tData);
    }, () => {});

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      const cData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setClients(cData);
    }, () => {});

    return () => {
      unsubProjects();
      unsubTasks();
      unsubClients();
    };
  }, [profile]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !profile) return;

    try {
      const created = await createProject({
        name: newTitle.trim(),
        description: newDesc.trim(),
        status: 'active',
        currentUser: profile,
      });

      setProjects(prev => [created, ...prev.filter(p => p.id !== created.id)]);
      setNotice({ type: 'success', text: `Project "${created.name}" created successfully!` });
      setTimeout(() => setNotice(null), 3000);
    } catch (error: any) {
      console.warn("Project creation error:", error);
      setNotice({ type: 'error', text: error?.message || 'Failed to create project.' });
    } finally {
      setNewTitle('');
      setNewDesc('');
      setShowCreate(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!profile) return;
    setDeletingId(project.id);
    try {
      await deleteProject(project.id, profile);
      deleteLocalProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setNotice({ type: 'success', text: `Project "${project.name}" deleted.` });
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      console.error('Delete project failed:', err);
      setNotice({ type: 'error', text: err?.message || 'Failed to delete project.' });
    } finally {
      setDeletingId(null);
      setConfirmDeleteProject(null);
    }
  };

  const filtered = projects.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto space-y-6">
      {notice && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border animate-in fade-in duration-150 ${
          notice.type === 'success' 
            ? 'bg-teal-950/50 border-teal-800 text-teal-300' 
            : 'bg-rose-950/50 border-rose-800 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <Check className="w-4 h-4 text-teal-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Folder className="w-6 h-6 text-accent" />
            Projects
          </h1>
          <p className="text-sm text-slate-400 mt-1">Organize work into focused projects and track milestone roadmaps.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Timeline (Gantt)
            </button>
          </div>

          <button 
            onClick={() => setShowCreate(true)}
            className="bg-accent text-slate-950 px-4 py-2 rounded-xl font-bold text-sm hover:bg-white transition-colors flex items-center gap-2 shrink-0 cursor-pointer shadow-md shadow-accent/10"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text" 
          placeholder="Search projects by name..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <h3 className="text-lg font-bold text-white mb-4">Create New Project</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Project Name</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g., Marketing Redesign Q4"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
              <textarea 
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Project overview, key objectives and deliverables..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent h-24 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white cursor-pointer">Cancel</button>
              <button type="submit" className="bg-accent text-slate-950 px-5 py-2 rounded-xl text-sm font-bold hover:bg-white cursor-pointer transition-colors">Create Project</button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
      ) : viewMode === 'timeline' ? (
        <ProjectTimelineView
          projects={filtered}
          tasks={tasks}
          clients={clients}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(project => {
            const isOwner = profile?.role === 'admin' || project.ownerId === profile?.id || project.createdBy === profile?.id;
            const isDeleting = deletingId === project.id;

            return (
              <div key={project.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-700 transition-all shadow-md group relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-accent/10 text-accent">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 rounded",
                      project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      project.status === 'completed' ? 'bg-slate-800 text-slate-400' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    )}>{project.status}</span>

                    {isOwner && (
                      <button
                        onClick={() => setConfirmDeleteProject(project)}
                        disabled={isDeleting}
                        title="Delete this project"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2">{project.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2 mb-6 flex-1">{project.description || 'No description provided.'}</p>
                
                <div className="pt-4 border-t border-slate-800 flex justify-between items-center mt-auto text-xs">
                  <span className="text-slate-500">{safeFormat(project.createdAt, 'MMM d, yyyy')}</span>
                  <Link to={`/projects/${project.id}`} className="font-bold text-accent hover:underline flex items-center gap-1">
                    Open Workspace →
                  </Link>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 text-sm space-y-2">
              <Folder className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-medium text-slate-300">No projects found</p>
              <p className="text-xs text-slate-500">Create a new project to start organizing tasks and documents.</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Delete Project?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to permanently delete <strong className="text-white">"{confirmDeleteProject.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteProject(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDeleteProject)}
                disabled={deletingId === confirmDeleteProject.id}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingId === confirmDeleteProject.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
