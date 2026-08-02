import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DocumentInfo, Client } from '../types';
import { Loader2, FileText, Search, ExternalLink } from 'lucide-react';
import { DriveUpload } from '../components/DriveUpload';
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';

export function Documents() {
  const { profile, user } = useAuth();
  const [docsList, setDocsList] = useState<DocumentInfo[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { users } = useUsers();

  // New Doc Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newClientId, setNewClientId] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);

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
      
      let docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentInfo));
      let clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      
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
        
        {(profile?.role === 'admin' || profile?.role === 'assistant') && (
          <button 
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {showUploadForm ? 'Cancel Upload' : 'Upload Document'}
          </button>
        )}
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
                  <div key={doc.id} className="p-4 md:p-5 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="p-3 bg-slate-800 rounded-xl text-slate-400 hidden sm:block">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-200 truncate">{doc.title}</h3>
                          {doc.ownerId && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                              {users[doc.ownerId] || 'Owner'}
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
                    <a 
                      href={doc.fileRef} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Open <ExternalLink className="w-4 h-4 hidden sm:inline" />
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
