const fs = require('fs');
let content = fs.readFileSync('src/pages/TaskDetail.tsx', 'utf8');

// Add edit states
if (!content.includes('isEditing')) {
  content = content.replace(
    /const \[isUpdating, setIsUpdating\] = useState\(false\);/,
    "const [isUpdating, setIsUpdating] = useState(false);\n  const [isEditing, setIsEditing] = useState(false);\n  const [editTitle, setEditTitle] = useState('');\n  const [editDesc, setEditDesc] = useState('');\n  const [editPriority, setEditPriority] = useState<any>('medium');\n  const [editDeadline, setEditDeadline] = useState('');\n  const [editAssignedTo, setEditAssignedTo] = useState('');"
  );

  // Initialize edit form when task loads
  content = content.replace(
    /setTask\(\{ id: docSnap\.id, \.\.\.docSnap\.data\(\) \} as Task\);/,
    "const t = { id: docSnap.id, ...docSnap.data() } as Task;\n          setTask(t);\n          setEditTitle(t.title);\n          setEditDesc(t.description || '');\n          setEditPriority(t.priority);\n          setEditDeadline(t.deadline ? t.deadline.substring(0, 10) : '');\n          setEditAssignedTo(t.assignedTo || '');"
  );

  // Import Edit
  content = content.replace(
    /import \{ Loader2, ArrowLeft, Trash2, CheckCircle2, Clock, Calendar as CalendarIcon, Tag, AlignLeft, User \} from 'lucide-react';/,
    "import { Loader2, ArrowLeft, Trash2, CheckCircle2, Clock, Calendar as CalendarIcon, Tag, AlignLeft, User, Edit } from 'lucide-react';"
  );

  const handleUpdate = `
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
  `;

  content = content.replace(
    /const handleDelete = async \(\) => \{/,
    handleUpdate + '\n  const handleDelete = async () => {'
  );

  // UI Updates: add Edit button
  const editButton = `
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-semibold transition-colors text-sm border border-slate-700">
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
  `;

  content = content.replace(
    /\{true && \(/,
    editButton + '\n          {true && ('
  );

  // Render edit form instead of details when isEditing
  const editForm = `
      {isEditing ? (
        <form onSubmit={handleUpdateDetails} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Edit Task Details</h2>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
            <input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
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
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-400 hover:text-white font-semibold">Cancel</button>
            <button type="submit" disabled={isUpdating} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 px-4 py-2 rounded-lg font-bold transition-colors">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">
  `;
  
  content = content.replace(
    /<div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">/,
    editForm
  );
  
  // Close the bracket at the end
  content = content.replace(
    /<\/div>\s*<\/div>\s*\);\s*\}/,
    '      </div>\n      )}\n    </div>\n  );\n}'
  );

  fs.writeFileSync('src/pages/TaskDetail.tsx', content);
  console.log('TaskDetail updated');
} else {
  console.log('Already updated');
}
