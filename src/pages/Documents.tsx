import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, orderBy, addDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DocumentInfo, Client } from '../types';
import { Loader2, FileText, Search, Copy, ExternalLink, Edit2, Trash2, Check, X } from 'lucide-react';
import { DriveUpload } from '../components/DriveUpload';
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
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let docsQuery, clientsQuery;
      if (profile?.role === 'admin' || profile?.role === 'assistant') {
        docsQuery = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
        clientsQuery = query(collection(db, 'clients'), orderBy('name'));
      } else {
        docsQuery = query(collection(db, 'documents'), where('ownerId', '==', profile?.id));
        clientsQuery = query(collection(db, 'clients'), where('ownerId', '==', profile?.id));
      }

      const [docsSnap, clientsSnap] = await Promise.all([
        getDocs(docsQuery),
        getDocs(clientsQuery)
      ]);
      
      let docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as DocumentInfo));
      let clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));
      
      if (profile?.role !== 'admin' && profile?.role !== 'assistant') {
        docsData = docsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        clientsData = clientsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      
      setDocsList(docsData);
      setClients(clientsData);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Documents</h1>
          <p className="text-sm text-slate-400">Company and client files</p>
        </div>
        
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(profile?.role === 'admin' || profile?.role === 'assistant') && (
            <>
              <button 
                onClick={() => setShowTemplates(true)}
                className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Create Document
              </button>
              <button 
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
              <select 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
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
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text"
          placeholder="Search documents by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {showTemplates && <TemplateSelector onSelect={handleCreateDocument} onClose={() => setShowTemplates(false)} />}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">
          <div className="divide-y divide-slate-800 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No documents found.</div>
            ) : (
              filteredDocs.map(doc => {
                const client = clients.find(c => c.id === doc.clientId);
                return (
                  <div key={doc.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 w-full sm:w-auto">
                      <div className="p-3 bg-slate-800 rounded-xl text-slate-400 hidden sm:block shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          
                          {editingDocId === doc.id ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-800 sm:border-0">
                              <input 
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent"
                                autoFocus
                              />
                              <button onClick={() => handleUpdateTitle(doc.id)} disabled={isUpdating} className="text-emerald-400 hover:text-emerald-300">
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button onClick={() => setEditingDocId(null)} disabled={isUpdating} className="text-slate-400 hover:text-slate-200">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <h3 className="font-semibold text-slate-200 truncate">{doc.title}</h3>
                          )}
  
                          {doc.ownerId && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                              {users[doc.ownerId] ? (
      <span className="flex items-center gap-1.5">
        {users[doc.ownerId].photoUrl ? (
          <img src={users[doc.ownerId].photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{users[doc.ownerId].name.charAt(0)}</span>
        )}
        {users[doc.ownerId].name}
      </span>
    ) : 'Owner'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                          <span className="uppercase tracking-wider text-accent">{doc.category}</span>
                          {client && <span>• {client.name}</span>}
                          <span>• {format(parseISO(doc.createdAt), 'MMM d')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {editingDocId !== doc.id && (profile?.role === 'admin' || profile?.role === 'assistant' || doc.ownerId === profile?.id) && (
                        <>
                          
                          <button 
                            onClick={() => handleDuplicateDoc(doc)}
                            title="Duplicate"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setEditingDocId(doc.id); setEditTitle(doc.title); }}

                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => confirmDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      
                      {doc.type === 'internal' ? (
                        <button 
                          onClick={() => navigate('/documents/' + doc.id)}
                          className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Open Editor
                        </button>
                      ) : (
                        <a 
                           href={doc.fileRef} 
                           target="_blank" 
                           rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          View File <ExternalLink className="w-4 h-4 hidden sm:inline" />
                        </a>
                      )}

                    </div>
  
                  </div>
                );
              })
            )}
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
