const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('* as Dialog')) {
  content = content.replace(
    /import \{ Link \} from 'react-router-dom';/,
    "import { Link } from 'react-router-dom';\nimport * as Dialog from '@radix-ui/react-dialog';\nimport { X } from 'lucide-react';\nimport { addDoc } from 'firebase/firestore';"
  );
}

// Add state variables
content = content.replace(
  /const \[searchQuery, setSearchQuery\] = useState\(''\);/,
  `const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskClient, setNewTaskClient] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [clientsList, setClientsList] = useState<{id: string, name: string}[]>([]);
`
);

// Add fetch clients logic inside useEffect
content = content.replace(
  /const unsubscribe = onSnapshot\(q, \(snapshot\) => \{/,
  `
    const fetchClients = async () => {
      const { getDocs, collection } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'clients'));
      setClientsList(snap.docs.map(d => ({id: d.id, name: d.data().name})));
    };
    fetchClients();
    
    const unsubscribe = onSnapshot(q, (snapshot) => {`
);

// Add create handler
const createHandler = `
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !profile) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        status: 'pending',
        assignedTo: newTaskAssignee || profile.id,
        createdBy: profile.id,
        clientId: newTaskClient || null,
        deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null,
        checklist: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsDialogOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('medium');
      setNewTaskClient('');
      setNewTaskAssignee('');
      setNewTaskDeadline('');
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
`;

content = content.replace(
  /const filteredTasks = tasks\.filter/,
  createHandler + '\n  const filteredTasks = tasks.filter'
);

// Replace button with Dialog
const dialogUI = `
          <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Task</span>
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
              <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl z-50 focus:outline-none max-h-[90vh] overflow-y-auto">
                <Dialog.Title className="text-xl font-bold text-white mb-4">Create New Task</Dialog.Title>
                <Dialog.Close className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </Dialog.Close>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                    <input type="text" required value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                    <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent min-h-[80px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
                      <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Deadline</label>
                      <input type="date" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Assign To</label>
                    <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                      <option value="">Self</option>
                      {Object.values(users).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Related Client (Optional)</label>
                    <select value={newTaskClient} onChange={e => setNewTaskClient(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                      <option value="">None</option>
                      {clientsList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors mt-6">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
                  </button>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
`;

content = content.replace(
  /<button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm">\s*<Plus className="w-4 h-4" \/>\s*<span className="hidden sm:inline">New Task<\/span>\s*<\/button>/,
  dialogUI.trim()
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks.tsx');
