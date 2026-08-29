import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, orderBy, addDoc, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DocumentInfo, Client } from '../types';
import { Loader2, FileText, Search, Copy, ExternalLink, Edit2, Trash2, Check, X, Clock, Cloud, Sparkles, MoreVertical } from 'lucide-react';
import { DriveUpload } from '../components/DriveUpload';
import { safeParseISO, safeFormat, formatExactTimestamp, formatShortTimestampWithSeconds } from "../lib/dateUtils";
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';
import { TemplateSelector } from '../components/documents/TemplateSelector';

export function Documents() {
  const { profile, user } = useAuth();
  const [docsList, setDocsList] = useState<DocumentInfo[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { users } = useUsers();

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [openPropertiesId, setOpenPropertiesId] = useState<string | null>(null);

  const handleUpdateTitle = async (id: string) => {
    if (!editTitle.trim()) return;
    setIsUpdating(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'documents', id), {
        title: editTitle.trim(),
        updatedAt: new Date().toISOString()
      });
      setDocsList(docsList.map(d => d.id === id ? { ...d, title: editTitle.trim() } : d));
      setEditingDocId(null);
    } catch (error) {
      console.error("Error updating document:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  
  const handleDuplicateDoc = async (docToDuplicate: DocumentInfo) => {
    if (!profile) return;
    try {
      const { ...docData } = docToDuplicate;
      delete (docData as any).id;
      
      const newDocRef = await addDoc(collection(db, 'documents'), {
        ...docData,
        title: `${docData.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: profile.id
      });
      // Optionally redirect to it, or just let the list update
    } catch (error) {
      console.error('Error duplicating doc:', error);
    }
  };

  const confirmDelete = (id: string) => { setDocToDelete(id); };
  const handleDeleteDoc = async (id: string) => {
    setDocToDelete(null);

    setDeletingId(id);
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'documents', id));
      setDocsList(docsList.filter(d => d.id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setDeletingId(null);
    }
  };
  

  // New Doc Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newClientId, setNewClientId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);

  
  
  const handleCreateDocument = async (title: string = 'Untitled Document', content: string = '') => {
    if (!profile) return;
    try {
      const newDocRef = await addDoc(collection(db, 'documents'), {
        title: title,
        type: 'internal',
        content: JSON.stringify(content ? content : { type: 'doc', content: [{ type: 'paragraph' }] }),
        category: 'other',
        ownerId: profile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowTemplates(false);
      navigate('/documents/' + newDocRef.id);
    } catch (error) {
      console.error('Error creating doc:', error);
    }
  };
  useEffect(() => {
    if (!profile) return;
    setLoading(true);

    const unsubDocs = onSnapshot(collection(db, 'documents'), (docsSnap) => {
      let docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as DocumentInfo));
      docsData = docsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      // If staff/teacher, show documents they created, own, or general workspace docs (templates/sop/reports)
      if (profile.role === 'staff' || profile.role === 'teacher') {
        docsData = docsData.filter(d => !d.ownerId || d.ownerId === profile.id || d.createdBy === profile.id || d.type === 'internal' || d.category === 'sop' || d.category === 'contracts');
      }
      
      // Keep the document list as the primary surface; metadata is available from each item's properties menu.
      docsData = docsData.map(d => ({ ...d }));
      setDocsList(docsData);
      setLoading(false);
    }, (error) => {
      console.warn("Error subscribing to documents:", error);
      setLoading(false);
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (clientsSnap) => {
      let clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));
      clientsData = clientsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClients(clientsData);
    });

    return () => {
      unsubDocs();
      unsubClients();
    };
  }, [user, profile]);

  const fetchData = async () => {
    if (!profile) return;
    try {
      const [docsSnap, clientsSnap] = await Promise.all([
        getDocs(collection(db, 'documents')),
        getDocs(collection(db, 'clients'))
      ]);
      
      let docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as DocumentInfo));
      let clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));
      
      docsData = docsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      clientsData = clientsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      if (profile.role === 'staff' || profile.role === 'teacher') {
        docsData = docsData.filter(d => !d.ownerId || d.ownerId === profile.id || d.createdBy === profile.id || d.type === 'internal' || d.category === 'sop' || d.category === 'contracts');
      }
      
      setDocsList(docsData);
      setClients(clientsData);
    } catch (error) {
      console.warn("Error fetching documents:", error);
    }
  };

  const handleUploadSuccess = async (webViewLink: string, fileId: string) => {
    if (!user || !profile) return;
    setIsUploading(true);
    try {
      const newDoc = {
        title: newTitle || 'Untitled Document',
        category: newCategory,
        clientId: newClientId || null,
        projectId: newProjectId || null,
        fileRef: webViewLink,
        version: 1,
        createdBy: profile.id,
        ownerId: profile.id,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'documents'), newDoc);
      setShowUploadForm(false);
      setNewTitle('');
      setNewClientId('');
      setNewProjectId('');
      fetchData();
    } catch (error) {
      console.error("Error saving document record:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = docsList.filter(d => (d.title || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Documents</h1>
          <p className="text-xs sm:text-sm text-slate-400">Company files, templates, and official records</p>
        </div>
        
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
          {(profile?.role === 'admin' || profile?.role === 'assistant') && (
            <>
              <button 
                onClick={() => setShowTemplates(true)}
                className="flex-1 sm:flex-none h-10 px-4 py-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold rounded-lg text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] shrink-0"
              >
                <FileText className="w-4 h-4" />
                <span>Create Document</span>
              </button>
              <button 
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="flex-1 sm:flex-none h-10 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium rounded-lg text-sm transition-all duration-150 flex items-center justify-center gap-2 border border-slate-700 active:scale-[0.98] shrink-0"
              >
                {showUploadForm ? 'Cancel Upload' : 'Upload File'}
              </button>
            </>
          )}
        </div>
      </div>

      {showUploadForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 shrink-0">
          <h2 className="font-semibold text-lg text-white">Upload New Document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
              <input 
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Q3 Report"
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-4 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
              <select 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3.5 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                <option value="contract">Contract</option>
                <option value="report">Report</option>
                <option value="invoice">Invoice</option>
                <option value="exam">Exam</option>
                <option value="certificate">Certificate</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Link to Project (Optional)</label>
              <select 
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3.5 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                <option value="">None</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
  
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Link to Client (Optional)</label>
              <select 
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3.5 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                <option value="">-- No Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="pt-6 mt-2 border-t border-slate-800">
            <DriveUpload onUploadSuccess={handleUploadSuccess} />
            {isUploading && <p className="text-sm text-accent mt-2 animate-pulse font-medium">Saving document record...</p>}
          </div>
        </div>
      )}

      <div className="relative shrink-0">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text"
          placeholder="Search documents by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
        />
      </div>

      {showTemplates && <TemplateSelector onSelect={handleCreateDocument} onClose={() => setShowTemplates(false)} />}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="divide-y divide-slate-800 border-y border-slate-800/70">
            {filteredDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No documents found.</div>
            ) : (
              filteredDocs.map(doc => {
                const client = clients.find(c => c.id === doc.clientId);
                const canManage = profile?.role === 'admin' || profile?.role === 'assistant' || doc.ownerId === profile?.id;
                return (
                  <div key={doc.id} className="group relative p-3 sm:p-4 hover:bg-slate-800/30 transition-colors" onContextMenu={(e) => { e.preventDefault(); setOpenPropertiesId(doc.id); }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => doc.type === 'internal' ? navigate('/documents/' + doc.id) : window.open(doc.fileRef, '_blank')} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                        <div className="w-11 h-12 sm:w-12 sm:h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-accent shrink-0 shadow-sm">
                          <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-100 truncate">{doc.title || 'Untitled Document'}</h3>
                          <p className="text-xs text-slate-500 truncate mt-1">{doc.category || 'Document'}{client ? ' • ' + client.name : ''}</p>
                          <p className="text-[11px] text-slate-500 mt-1">Edited {formatShortTimestampWithSeconds(doc.lastEditedAt || doc.updatedAt || doc.createdAt)}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => doc.type === 'internal' ? navigate('/documents/' + doc.id) : window.open(doc.fileRef, '_blank')} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-slate-950 text-xs font-bold hover:bg-accent-hover transition-colors">{doc.type === 'internal' ? 'Open' : 'View'}</button>
                        <button onClick={() => setOpenPropertiesId(openPropertiesId === doc.id ? null : doc.id)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" aria-label="Document options"><MoreVertical className="w-5 h-5" /></button>
                      </div>
                    </div>
                    {openPropertiesId === doc.id && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 shadow-xl">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-3">
                          <div><span className="text-slate-500 block">Created</span><span className="text-slate-200">{formatShortTimestampWithSeconds(doc.createdAt)}</span></div>
                          <div><span className="text-slate-500 block">Edited</span><span className="text-slate-200">{formatShortTimestampWithSeconds(doc.lastEditedAt || doc.updatedAt || doc.createdAt)}</span></div>
                          <div><span className="text-slate-500 block">Saved</span><span className="text-slate-200">{formatShortTimestampWithSeconds(doc.lastSavedAt || doc.updatedAt || doc.createdAt)}</span></div>
                          <div><span className="text-slate-500 block">Owner</span><span className="text-slate-200 truncate">{doc.ownerId && users[doc.ownerId] ? users[doc.ownerId].name : 'Workspace'}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => { setOpenPropertiesId(null); doc.type === 'internal' ? navigate('/documents/' + doc.id) : window.open(doc.fileRef, '_blank'); }} className="px-3 py-2 rounded-lg bg-accent text-slate-950 text-xs font-bold">Open</button>
                          {canManage && <><button onClick={() => { setOpenPropertiesId(null); setEditingDocId(doc.id); setEditTitle(doc.title); }} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs">Rename</button><button onClick={() => handleDuplicateDoc(doc)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs">Duplicate</button><button onClick={() => { setOpenPropertiesId(null); confirmDelete(doc.id); }} className="px-3 py-2 rounded-lg bg-rose-950/40 text-rose-300 text-xs">Delete</button></>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })           )}
          </div>
        </div>
      )}

      {docToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Document</h3>
            <p className="text-sm text-slate-300 mb-6">Are you sure you want to delete this document? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteDoc(docToDelete)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
