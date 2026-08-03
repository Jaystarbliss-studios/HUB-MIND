const fs = require('fs');
let content = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

if (!content.includes('editingDocId')) {
  // 1. Add imports
  content = content.replace(
    /import \{ Loader2, FileText, Search, ExternalLink \} from 'lucide-react';/,
    "import { Loader2, FileText, Search, ExternalLink, Edit2, Trash2, Check, X } from 'lucide-react';"
  );

  // 2. Add state and handlers
  const stateHooks = `
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
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
  `;
  content = content.replace(
    /const \{ users \} = useUsers\(\);/,
    "const { users } = useUsers();\n" + stateHooks
  );

  // 3. Render edit/delete controls inline
  // Find where doc.title is rendered:
  // <h3 className="font-semibold text-slate-200 truncate">{doc.title}</h3>
  
  const titleRender = `
                          {editingDocId === doc.id ? (
                            <div className="flex items-center gap-2">
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
  `;

  content = content.replace(
    /<h3 className="font-semibold text-slate-200 truncate">\{doc\.title\}<\/h3>/,
    titleRender
  );

  // 4. Add edit/delete buttons next to "Open" link
  // admin can delete all, users can only delete what they uploaded (doc.ownerId === profile?.id)
  
  const actionButtons = `
                    <div className="flex items-center gap-2">
                      {editingDocId !== doc.id && (profile?.role === 'admin' || profile?.role === 'assistant' || doc.ownerId === profile?.id) && (
                        <>
                          <button 
                            onClick={() => { setEditingDocId(doc.id); setEditTitle(doc.title); }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={deletingId === doc.id}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      <a 
                        href={doc.fileRef} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-bold text-slate-950 bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Open <ExternalLink className="w-4 h-4 hidden sm:inline" />
                      </a>
                    </div>
  `;

  content = content.replace(
    /<a\s+href=\{doc\.fileRef\}[\s\S]*?<\/a>/,
    actionButtons
  );

  fs.writeFileSync('src/pages/Documents.tsx', content);
  console.log('Documents updated');
} else {
  console.log('Already updated');
}
