const fs = require('fs');
let content = fs.readFileSync('src/pages/Clients.tsx', 'utf8');

// Ensure addDoc is imported
if (!content.includes('addDoc')) {
  content = content.replace(/getDocs, orderBy, where/, 'getDocs, orderBy, where, addDoc');
}
if (!content.includes('* as Dialog')) {
  content = content.replace(/import \{ Link \} from 'react-router-dom';/, "import { Link } from 'react-router-dom';\nimport * as Dialog from '@radix-ui/react-dialog';\nimport { X } from 'lucide-react';");
}

// Add state for Dialog
content = content.replace(
  /const \[activeTab, setActiveTab\] = useState.*?;/,
  "const [activeTab, setActiveTab] = useState<'all' | 'school' | 'parent' | 'partner'>('all');\n  const [isDialogOpen, setIsDialogOpen] = useState(false);\n  const [isSubmitting, setIsSubmitting] = useState(false);\n  const [newClientName, setNewClientName] = useState('');\n  const [newClientType, setNewClientType] = useState<'school' | 'parent' | 'partner'>('school');\n  const [newClientEmail, setNewClientEmail] = useState('');\n  const [newClientPhone, setNewClientPhone] = useState('');"
);

const filterRegex = /const filteredClients = clients\.filter\(c => \s*\(c\.name \|\| ''\)\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\) \|\|\s*\(c\.email \|\| ''\)\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\)\s*\);/m;

const correctFilter = `const filteredClients = clients.filter(c => 
    (activeTab === 'all' || c.type === activeTab) &&
    ((c.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.email || '').toLowerCase().includes(search.toLowerCase()))
  );`;

if (filterRegex.test(content)) {
  content = content.replace(filterRegex, correctFilter);
}

// Add handleCreateClient function
const handleCreateClientStr = `
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !profile) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        name: newClientName,
        type: newClientType,
        email: newClientEmail,
        phone: newClientPhone,
        status: 'active',
        ownerId: profile.id,
        createdAt: new Date().toISOString()
      });
      const newClient = {
        id: docRef.id,
        name: newClientName,
        type: newClientType,
        email: newClientEmail,
        phone: newClientPhone,
        status: 'active',
        ownerId: profile.id,
        createdAt: new Date().toISOString()
      } as Client;
      setClients(prev => [newClient, ...prev].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setIsDialogOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientType('school');
    } catch (error) {
      console.error("Error adding client:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
`;

content = content.replace(
  /const getClientIcon/,
  handleCreateClientStr + '\n  const getClientIcon'
);

// Replace button with Dialog
const dialogStr = `
        {(profile?.role === 'admin' || profile?.role === 'assistant') && (
          <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                <Plus className="w-4 h-4" />
                New Client
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
              <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl z-50 focus:outline-none">
                <Dialog.Title className="text-xl font-bold text-white mb-4">Add New Client</Dialog.Title>
                <Dialog.Close className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </Dialog.Close>
                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
                    <input 
                      type="text" 
                      required
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent"
                      placeholder="Client Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                    <select 
                      value={newClientType}
                      onChange={(e) => setNewClientType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent"
                    >
                      <option value="school">School</option>
                      <option value="parent">Parent</option>
                      <option value="partner">Partner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                    <input 
                      type="email" 
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                    <input 
                      type="text" 
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors mt-6"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Client'}
                  </button>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
`;

content = content.replace(
  /\{\(profile\?\.role === 'admin' \|\| profile\?\.role === 'assistant'\) && \([\s\S]*?<\/button>\s*\)\}/,
  dialogStr.trim()
);

fs.writeFileSync('src/pages/Clients.tsx', content);
console.log('Updated Clients.tsx');
