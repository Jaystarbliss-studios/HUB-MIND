import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { Project, Task, Client } from '../types';
import { getLocalProjects, setLocalProjects, upsertLocalProject } from '../lib/localWorkspaceStore';
import { logActivity } from '../lib/activity';
import { Loader2, Plus, Folder, Search, LayoutGrid, CalendarRange } from 'lucide-react';
import { safeParseISO, safeFormat } from "../lib/dateUtils";
import { format, parseISO } from 'date-fns';
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
    if (!newTitle.trim()) return;
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: newTitle,
      description: newDesc,
      status: 'active',
      ownerId: profile?.id || 'default_user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    upsertLocalProject(newProj);
    setProjects(prev => [newProj, ...prev]);

    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name: newTitle,
        description: newDesc,
        status: 'active',
        ownerId: profile?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await logActivity(docRef.id, 'project', 'created project', newTitle, profile?.name || 'User');
    } catch (error) {
      console.warn("Saved project locally (cloud sync pending):", error);
    } finally {
      setNewTitle('');
      setNewDesc('');
      setShowCreate(false);
    }
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto space-y-6">
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
            className="bg-accent text-slate-950 px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text" 
          placeholder="Search projects..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Create New Project</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Project Name</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
              <textarea 
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent h-24 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white">Cancel</button>
              <button type="submit" className="bg-accent text-slate-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-white">Create</button>
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
          {filtered.map(project => (
            <div key={project.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-accent/10 text-accent">
                  <Folder className="w-6 h-6" />
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase px-2 py-1 rounded",
                  project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  project.status === 'completed' ? 'bg-slate-800 text-slate-400' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                )}>{project.status}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{project.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 mb-6 flex-1">{project.description || 'No description provided.'}</p>
              
              <div className="pt-4 border-t border-slate-800 flex justify-between items-center mt-auto">
                <span className="text-xs text-slate-500">{safeFormat(project.createdAt, 'MMM d, yyyy')}</span>
                <Link to={`/projects/${project.id}`} className="text-sm font-bold text-accent hover:underline">View Project</Link>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 text-sm">
              No projects found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
