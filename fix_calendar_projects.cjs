const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

if (!content.includes('projectsList')) {
  content = content.replace(
    /const \[clientId, setClientId\] = useState\(''\);/,
    "const [clientId, setClientId] = useState('');\n  const [projectId, setProjectId] = useState('');\n  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);"
  );

  content = content.replace(
    /const fetchClients = async \(\) => \{/,
    "const fetchClients = async () => {\n      const pSnap = await getDocs(collection(db, 'projects'));\n      setProjectsList(pSnap.docs.map(d => ({id: d.id, name: d.data().name})));"
  );

  content = content.replace(
    /clientId: clientId \|\| null,/,
    "clientId: clientId || null,\n          projectId: projectId || null,"
  );
  
  // also for meetings
  content = content.replace(
    /ownerId: profile\.id,/,
    "ownerId: profile.id,\n          projectId: projectId || null,"
  );

  content = content.replace(
    /setClientId\(''\);/,
    "setClientId('');\n    setProjectId('');"
  );

  const projectSelector = `
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Related Project (Optional)</label>
                        <select 
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-accent text-sm"
                        >
                          <option value="">None</option>
                          {projectsList.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
  `;
  
  content = content.replace(
    /\{formType === 'task' && \(/,
    projectSelector + '\n{formType === ' + "'task'" + ' && ('
  );

  fs.writeFileSync('src/pages/Calendar.tsx', content);
  console.log('Calendar projects updated');
}
