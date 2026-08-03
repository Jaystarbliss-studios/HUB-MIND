const fs = require('fs');
let content = fs.readFileSync('src/pages/Inbox.tsx', 'utf8');

// Add viewMode state
content = content.replace(
  /const \[actionTime, setActionTime\] = useState\(''\);/,
  "const [actionTime, setActionTime] = useState('');\n  const [viewMode, setViewMode] = useState<'unprocessed' | 'processed'>('unprocessed');"
);

// Update query in useEffect to depend on viewMode
const useEffectRegex = /useEffect\(\(\) => \{[\s\S]*?\}, \[profile\]\);/;
const updatedUseEffect = `useEffect(() => {
    if (!profile) return;
    const q = profile.role === 'admin' || profile.role === 'assistant'
      ? query(
          collection(db, 'inbox'),
          where('status', '==', viewMode)
        )
      : query(
          collection(db, 'inbox'),
          where('status', '==', viewMode),
          where('createdBy', '==', profile.id)
        );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as InboxItem));
      data = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching inbox:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile, viewMode]);`;

content = content.replace(useEffectRegex, updatedUseEffect);

// Add toggle button to header
const headerRegex = /<div>\s*<h1 className="text-3xl font-bold text-white tracking-tight">Inbox<\/h1>[\s\S]*?<\/div>/;
const headerReplacement = `<div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Inbox</h1>
          <p className="text-sm text-slate-400">Process raw inputs into actionable items</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shrink-0">
          <button 
            onClick={() => setViewMode('unprocessed')}
            className={\`px-4 py-2 text-sm font-semibold transition-colors \${viewMode === 'unprocessed' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-slate-200'}\`}
          >
            Needs Action
          </button>
          <button 
            onClick={() => setViewMode('processed')}
            className={\`px-4 py-2 text-sm font-semibold transition-colors \${viewMode === 'processed' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-slate-200'}\`}
          >
            Archived/Processed
          </button>
        </div>`;

content = content.replace(headerRegex, headerReplacement);

fs.writeFileSync('src/pages/Inbox.tsx', content);
console.log('Fixed Inbox.tsx viewMode');
