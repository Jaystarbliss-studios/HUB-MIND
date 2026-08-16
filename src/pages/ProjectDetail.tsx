import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { Project, Task, Meeting, DocumentInfo, ActivityLog } from '../types';
import { Loader2, ArrowLeft, Folder, CheckSquare, Calendar, FileText, Activity } from 'lucide-react';
import { safeParseISO, safeFormat } from "../lib/dateUtils";
import { format, parseISO } from 'date-fns';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !profile) return;

    const fetchProjectData = async () => {
      setLoading(true);
      try {
        const pDoc = await getDoc(doc(db, 'projects', id));
        if (pDoc.exists()) setProject({ id: pDoc.id, ...pDoc.data() } as Project);

        // Fetch related entities
        const tQ = query(collection(db, 'tasks'), where('projectId', '==', id));
        const mQ = query(collection(db, 'meetings'), where('projectId', '==', id));
        const dQ = query(collection(db, 'documents'), where('projectId', '==', id));
        const aQ = query(collection(db, 'activityLogs'), where('entityId', '==', id));

        const [tSnap, mSnap, dSnap, aSnap] = await Promise.all([
          getDocs(tQ), getDocs(mQ), getDocs(dQ), getDocs(aQ)
        ]);

        setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        setMeetings(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
        setDocuments(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentInfo)));
        setLogs(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));

      } catch (error) {
        console.error("Error fetching project details", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [id, profile]);

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;
  if (!project) return <div className="p-12 text-center text-slate-500">Project not found.</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <Link to="/projects" className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-white uppercase tracking-wider mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
        </Link>
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-accent/10 text-accent shrink-0">
            <Folder className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{project.name}</h1>
            <p className="text-slate-400 mt-1">{project.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Related Entities */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tasks */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <CheckSquare className="w-4 h-4 text-accent" /> Tasks ({tasks.length})
            </h3>
            {tasks.length === 0 ? <p className="text-sm text-slate-500">No tasks assigned to this project.</p> : (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="p-3 border border-slate-800 rounded-xl bg-slate-950/50 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-200">{t.title}</span>
                    <span className="text-xs text-slate-500">{t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Meetings */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-blue-400" /> Meetings ({meetings.length})
            </h3>
            {meetings.length === 0 ? <p className="text-sm text-slate-500">No meetings for this project.</p> : (
              <div className="space-y-2">
                {meetings.map(m => (
                  <div key={m.id} className="p-3 border border-slate-800 rounded-xl bg-slate-950/50 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-200">{m.notesRaw.split('\n')[0] || 'Meeting'}</span>
                    <span className="text-xs text-slate-500">{safeFormat(m.date, 'MMM d')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Documents & Activity */}
        <div className="space-y-8">
          {/* Documents */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-yellow-400" /> Documents ({documents.length})
            </h3>
            {documents.length === 0 ? <p className="text-sm text-slate-500">No documents linked.</p> : (
              <div className="space-y-2">
                {documents.map(d => (
                  <div key={d.id} className="p-3 border border-slate-800 rounded-xl bg-slate-950/50 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-200">{d.title}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity Logs */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" /> Project Activity
            </h3>
            {logs.length === 0 ? <p className="text-sm text-slate-500">No activity yet.</p> : (
              <div className="space-y-4">
                {logs.map(log => (
                  <div key={log.id} className="relative pl-4 border-l border-slate-800">
                    <div className="absolute w-2 h-2 rounded-full bg-slate-700 -left-[4.5px] top-1.5" />
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">{log.userId}</span> {log.action} <span className="font-bold text-white">{log.details}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{safeFormat(log.createdAt, 'MMM d, h:mm a')}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
