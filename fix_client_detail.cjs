const fs = require('fs');
let content = fs.readFileSync('src/pages/ClientDetail.tsx', 'utf8');

// Import updateDoc and deleteDoc
if (!content.includes('updateDoc')) {
  content = content.replace(
    /import \{ doc, getDoc, collection, query, where, getDocs, orderBy \} from 'firebase\/firestore';/,
    "import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';"
  );
}

// Add state for edit mode and form
if (!content.includes('const [isEditing, setIsEditing] = useState(false)')) {
  content = content.replace(
    /const \[loading, setLoading\] = useState\(true\);/,
    "const [loading, setLoading] = useState(true);\n  const [isEditing, setIsEditing] = useState(false);\n  const [editName, setEditName] = useState('');\n  const [editEmail, setEditEmail] = useState('');\n  const [editPhone, setEditPhone] = useState('');\n  const [editType, setEditType] = useState<any>('other');\n  const [editStatus, setEditStatus] = useState<any>('lead');\n  const [isUpdating, setIsUpdating] = useState(false);\n  const [isDeleting, setIsDeleting] = useState(false);"
  );

  // Initialize edit form when client loads
  content = content.replace(
    /setClient\(\{ id: docSnap\.id, \.\.\.docSnap\.data\(\) \} as Client\);/,
    "const c = { id: docSnap.id, ...docSnap.data() } as Client;\n          setClient(c);\n          setEditName(c.name);\n          setEditEmail(c.email || '');\n          setEditPhone(c.phone || '');\n          setEditType(c.type);\n          setEditStatus(c.status);"
  );

  // Add save and delete handlers
  const handlers = `
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !client) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'clients', id), {
        name: editName,
        email: editEmail,
        phone: editPhone,
        type: editType,
        status: editStatus,
        updatedAt: new Date().toISOString()
      });
      setClient({ ...client, name: editName, email: editEmail, phone: editPhone, type: editType, status: editStatus });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating client:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this client? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'clients', id));
      navigate('/clients');
    } catch (error) {
      console.error("Error deleting client:", error);
      setIsDeleting(false);
    }
  };
  `;
  
  content = content.replace(
    /const getClientIcon = \(type: string\) => \{/,
    handlers + '\n  const getClientIcon = (type: string) => {'
  );

  // Add edit and delete buttons in the top right
  const buttons = `
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-semibold">
                <Edit className="w-4 h-4" /> Edit
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-semibold">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </>
          )}
        </div>
      </div>
  `;
  
  content = content.replace(
    /<\/button>\s*<\/div>\s*<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shrink-0">/,
    '</button>\n' + buttons + '\n      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shrink-0">'
  );

  // Render edit form instead of details when isEditing
  const editForm = `
        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Edit Client Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                  <select value={editType} onChange={e => setEditType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                    <option value="school">School</option>
                    <option value="parent">Parent</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
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
          <div className="flex flex-col md:flex-row gap-6 items-start">
  `;
  
  content = content.replace(
    /<div className="flex flex-col md:flex-row gap-6 items-start">/,
    editForm
  );
  
  content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pb-4">/,
    '          </div>\n        </div>\n        )}\n      </div>\n      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pb-4">'
  );

  fs.writeFileSync('src/pages/ClientDetail.tsx', content);
  console.log('ClientDetail updated');
}
