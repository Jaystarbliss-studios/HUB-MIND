const fs = require('fs');
let content = fs.readFileSync('src/pages/Clients.tsx', 'utf8');

// Add activeTab state
content = content.replace(
  /const \[search, setSearch\] = useState\(''\);/,
  "const [search, setSearch] = useState('');\n  const [activeTab, setActiveTab] = useState<'all' | 'school' | 'parent' | 'partner'>('all');"
);

// Update filter logic
content = content.replace(
  /const filteredClients = clients\.filter\(c => \n\s*\(c\.name \|\| ''\)\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\) \|\|\n\s*\(c\.email \|\| ''\)\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\)\n\s*\);/m,
  `const filteredClients = clients.filter(c => 
    (activeTab === 'all' || c.type === activeTab) &&
    ((c.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.email || '').toLowerCase().includes(search.toLowerCase()))
  );`
);

// Add tabs UI above search
const tabsUI = `
      <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 hide-scrollbar">
        {['all', 'school', 'parent', 'partner'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={\`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap transition-colors \${
              activeTab === tab 
                ? 'bg-accent text-slate-950' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
            }\`}
          >
            {tab}
          </button>
        ))}
      </div>
`;

content = content.replace(
  /<div className="relative shrink-0">/,
  tabsUI + '\n      <div className="relative shrink-0">'
);

fs.writeFileSync('src/pages/Clients.tsx', content);
console.log('Fixed Clients.tsx tabs');
