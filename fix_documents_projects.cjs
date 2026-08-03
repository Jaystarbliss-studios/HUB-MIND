const fs = require('fs');
let content = fs.readFileSync('src/pages/Documents.tsx', 'utf8');

if (!content.includes('projectsList')) {
  // Add state
  content = content.replace(
    /const \[clients, setClients\] = useState<Client\[\]>\(\[\]\);/,
    "const [clients, setClients] = useState<Client[]>([]);\n  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);"
  );
  
  content = content.replace(
    /const \[newClientId, setNewClientId\] = useState\(''\);/,
    "const [newClientId, setNewClientId] = useState('');\n  const [newProjectId, setNewProjectId] = useState('');"
  );

  // Fetch projects inside fetchData
  content = content.replace(
    /const clientsData = clientsSnap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.\(doc\.data\(\) as any\) \} as Client\)\);/,
    "const clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));\n      const projectsSnap = await getDocs(collection(db, 'projects'));\n      const projectsData = projectsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));\n      setProjectsList(projectsData);"
  );

  // Add projectId to addDoc
  content = content.replace(
    /clientId: newClientId \|\| null,/,
    "clientId: newClientId || null,\n        projectId: newProjectId || null,"
  );

  // Reset projectId
  content = content.replace(
    /setNewClientId\(''\);/,
    "setNewClientId('');\n      setNewProjectId('');"
  );

  // Add Project UI
  const projectSelector = `
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
  `;
  
  content = content.replace(
    /<div className="sm:col-span-2">/,
    projectSelector + '\n            <div className="sm:col-span-2">'
  );

  fs.writeFileSync('src/pages/Documents.tsx', content);
  console.log('Documents projects updated');
} else {
  console.log('Already updated');
}
