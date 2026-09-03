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
import { sanitizeClipboardHtml } from '../components/documents/clipboard/clipboard-sanitizer';
import { normalizeClipboardHtml } from '../components/documents/clipboard/clipboard-normalizer';
import { deleteDocumentOffline, repairBlankDocumentsFromHistory, getLocalDocsMap, setLocalDocsMap } from '../lib/offlineSync';

export function Documents() {
  const { profile, user } = useAuth();

  // Load any cached documents immediately on mount so documents appear in 0ms with no hanging spinner
  const getInitialDocs = (): DocumentInfo[] => {
    try {
      const localMap = getLocalDocsMap();
      const items = Object.values(localMap || {}).map(doc => ({
        id: doc.id,
        title: doc.title || 'Untitled Document',
        content: doc.content || '',
        contentJson: doc.contentJson,
        updatedAt: doc.updatedAt,
        lastSavedAt: doc.lastSavedAt,
        lastEditedAt: doc.lastEditedAt,
        category: 'other',
        type: 'internal' as const,
        version: 1,
        ownerId: '',
        createdBy: '',
        createdAt: doc.updatedAt || new Date().toISOString(),
      } as DocumentInfo));

      return items.sort((a, b) => {
        const aTime = new Date(a.lastEditedAt || a.lastSavedAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastEditedAt || b.lastSavedAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    } catch {
      return [];
    }
  };

  const [docsList, setDocsList] = useState<DocumentInfo[]>(() => getInitialDocs());
  const [clients, setClients] = useState<Client[]>([]);
  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(() => getInitialDocs().length === 0);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { users } = useUsers();

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [openPropertiesId, setOpenPropertiesId] = useState<string | null>(null);

  const handleUpdateTitle = async (id: string) => {
    if (!editTitle.trim()) return;
    setIsUpdating(true);
    const trimmedTitle = editTitle.trim();
    const now = new Date().toISOString();
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'documents', id), {
        title: trimmedTitle,
        updatedAt: now,
      });
      const localDocs = getLocalDocsMap();
      if (localDocs[id]) {
        localDocs[id].title = trimmedTitle;
        localDocs[id].updatedAt = now;
        setLocalDocsMap(localDocs);
      }
      setDocsList(docsList.map(d => d.id === id ? { ...d, title: trimmedTitle } : d));
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
      setDeleteError(null);
      await deleteDocumentOffline(id);
      setDocsList(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
      setDeleteError(error instanceof Error ? error.message : 'Could not permanently delete this document.');
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

  
  
  const handleCreateDocument = async (
    title: string = 'Untitled Document',
    content: string = '',
    category: string = 'other',
    templateId?: string
  ) => {
    if (!profile) return;

    // Templates are already valid TipTap HTML. Store that HTML directly instead of
    // JSON-stringifying the HTML string. The old implementation produced a JSON
    // string literal (e.g. "\"<p>..."), which the editor could not render.
    const normalizedTemplate = content
      ? normalizeClipboardHtml(sanitizeClipboardHtml(content), 'hubmind-template')
      : '';

    const initialHtml = normalizedTemplate || '<p></p>';
    const initialJson = normalizedTemplate ? null : { type: 'doc', content: [{ type: 'paragraph' }] };
    const initialTitle = title.trim() || 'Untitled Document';
    const now = new Date().toISOString();

    try {
      const newDocPayload: Record<string, any> = {
        title: initialTitle,
        type: 'internal',
        content: initialHtml,
        category: category || 'other',
        templateId: templateId || 'blank',
        ownerId: profile.id,
        createdBy: profile.id,
        createdAt: now,
        updatedAt: now,
        lastEditedAt: now,
        lastSavedAt: now,
      };
      if (initialJson) {
        newDocPayload.contentJson = initialJson;
      }

      const newDocRef = await addDoc(collection(db, 'documents'), newDocPayload);

      // Pre-populate local cache so document is immediately available locally
      const localDocs = getLocalDocsMap();
      localDocs[newDocRef.id] = {
        id: newDocRef.id,
        title: initialTitle,
        content: initialHtml,
        ...(initialJson ? { contentJson: initialJson } : {}),
        updatedAt: now,
        lastSavedAt: now,
        lastEditedAt: now,
        lastModifiedBy: profile.preferredName || profile.name || 'User',
        synced: true,
      };
      setLocalDocsMap(localDocs);

      setShowTemplates(false);
      navigate('/documents/' + newDocRef.id);
    } catch (error) {
      console.error('Error creating document:', error);
    }
  };
  useEffect(() => {
    // Failsafe timeout: ensure loading spinner never hangs indefinitely (max 1.5s)
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 1500);

    let unsubDocs = () => {};
    let unsubClients = () => {};

    try {
      unsubDocs = onSnapshot(collection(db, 'documents'), (docsSnap) => {
        clearTimeout(safetyTimeout);
        let docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as DocumentInfo));

        // Sync retrieved documents into local storage cache for instant offline access
        try {
          const localMap = getLocalDocsMap();
          let localModified = false;
          docsData.forEach(d => {
            if (!localMap[d.id] || (d.updatedAt && (!localMap[d.id].updatedAt || d.updatedAt > (localMap[d.id].updatedAt || '')))) {
              localMap[d.id] = {
                id: d.id,
                title: d.title || 'Untitled Document',
                content: (d as any).content || '',
                contentJson: (d as any).contentJson,
                updatedAt: d.updatedAt || d.lastEditedAt || new Date().toISOString(),
                lastSavedAt: d.lastSavedAt || d.updatedAt || new Date().toISOString(),
                lastEditedAt: d.lastEditedAt || d.updatedAt || new Date().toISOString(),
                synced: true,
              };
              localModified = true;
            }
          });

          // Also merge in any local drafts not yet present in the Firestore collection
          const cloudIds = new Set(docsData.map(d => d.id));
          Object.entries(localMap).forEach(([id, localDoc]) => {
            if (!cloudIds.has(id)) {
              docsData.push({
                id,
                title: localDoc.title || 'Untitled Document',
                content: localDoc.content || '',
                contentJson: localDoc.contentJson,
                updatedAt: localDoc.updatedAt,
                lastSavedAt: localDoc.lastSavedAt,
                lastEditedAt: localDoc.lastEditedAt,
                category: 'other',
                type: 'internal',
                version: 1,
                ownerId: '',
                createdBy: '',
                createdAt: localDoc.updatedAt || new Date().toISOString(),
              } as DocumentInfo);
            }
          });

          if (localModified) {
            setLocalDocsMap(localMap);
          }
        } catch (e) {
          console.warn('Could not sync cloud docs to local map:', e);
        }

        docsData = docsData.sort((a, b) => {
          const aTime = new Date(a.lastEditedAt || a.lastSavedAt || a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.lastEditedAt || b.lastSavedAt || b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

        // If staff/teacher, show documents they created, own, or general workspace docs (templates/sop/reports)
        if (profile && (profile.role === 'staff' || profile.role === 'teacher')) {
          docsData = docsData.filter(d => !d.ownerId || d.ownerId === profile.id || d.createdBy === profile.id || d.type === 'internal' || d.category === 'sop' || d.category === 'contracts');
        }

        // Keep the document list as the primary surface; metadata is available from each item's properties menu.
        docsData = docsData.map(d => ({ ...d }));
        setDocsList(docsData);
        setLoading(false);
      }, (error) => {
        clearTimeout(safetyTimeout);
        console.warn("Error subscribing to documents:", error);
        setLoading(false);
      });
    } catch (e) {
      clearTimeout(safetyTimeout);
      console.warn("Failed to subscribe to documents:", e);
      setLoading(false);
    }

    try {
      unsubClients = onSnapshot(collection(db, 'clients'), (clientsSnap) => {
        let clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));
        clientsData = clientsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setClients(clientsData);
      }, (error) => {
        console.warn("Error subscribing to clients:", error);
      });
    } catch (e) {
      console.warn("Failed to subscribe to clients:", e);
    }

    return () => {
      clearTimeout(safetyTimeout);
      unsubDocs();
      unsubClients();
    };
  }, [user, profile]);

  const fetchData = async () => {
    try {
      const [docsSnap, clientsSnap] = await Promise.all([
        getDocs(collection(db, 'documents')),
        getDocs(collection(db, 'clients'))
      ]);
      
      let docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as DocumentInfo));
      let clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));
      
      docsData = docsData.sort((a, b) => {
        const aTime = new Date(a.lastEditedAt || a.lastSavedAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastEditedAt || b.lastSavedAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      clientsData = clientsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      if (profile && (profile.role === 'staff' || profile.role === 'teacher')) {
        docsData = docsData.filter(d => !d.ownerId || d.ownerId === profile.id || d.createdBy === profile.id || d.type === 'internal' || d.category === 'sop' || d.category === 'contracts');
      }
      
      setDocsList(docsData);
      setClients(clientsData);
      setLoading(false);
    } catch (error) {
      console.warn("Error fetching documents:", error);
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

  const openDocument = (doc: DocumentInfo) => {
    // Anything created/saved by Hub-Mind's editor must always open in the
    // internal editor. Older records may not have type='internal' and newer
    // records may persist canonical Tiptap JSON instead of HTML.
    const isEditorDocument =
      doc.type === 'internal' ||
      !!(doc as any).content ||
      !!(doc as any).contentJson ||
      !!(doc as any).templateId;

    if (isEditorDocument || !(doc as any).fileRef) {
      navigate('/documents/' + doc.id);
      return;
    }

    window.open((doc as any).fileRef, '_blank', 'noopener,noreferrer');
  };

  // One-time conservative recovery pass for documents whose canonical
  // Firebase body is empty but whose saved version history still contains
  // the document. Runs non-blockingly with a delay so it never slows down page load.
  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'assistant')) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void repairBlankDocumentsFromHistory()
        .then(result => {
          if (!cancelled && result.repaired > 0) {
            console.info('[HubMind] Repaired blank documents:', result.repaired, 'of', result.checked);
            fetchData();
          }
        })
        .catch(error => console.warn('[HubMind] Document recovery pass failed:', error));
    }, 3500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile?.id, profile?.role]);

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
                      <button onClick={() => openDocument(doc)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
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
                        <button onClick={() => openDocument(doc)} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-slate-950 text-xs font-bold hover:bg-accent-hover transition-colors">{(doc.type === 'internal' || !!(doc as any).content || !!(doc as any).contentJson || !!(doc as any).templateId || !(doc as any).fileRef) ? 'Open' : 'View'}</button>
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
                          <button onClick={() => { setOpenPropertiesId(null); openDocument(doc); }} className="px-3 py-2 rounded-lg bg-accent text-slate-950 text-xs font-bold">Open</button>
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
            <p className="text-sm text-slate-300 mb-2">Are you sure you want to permanently delete this document from Hub-Mind and Firebase? This action cannot be undone.</p>
            {deleteError && <p className="text-xs text-rose-300 mb-4">{deleteError}</p>}
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
