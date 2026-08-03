const fs = require('fs');
let content = fs.readFileSync('src/pages/TaskDetail.tsx', 'utf8');

if (!content.includes('editProjectId')) {
  // Add editProjectId and editClientId
  content = content.replace(
    /const \[editAssignedTo, setEditAssignedTo\] = useState\(''\);/,
    "const [editAssignedTo, setEditAssignedTo] = useState('');\n  const [editProjectId, setEditProjectId] = useState('');\n  const [editClientId, setEditClientId] = useState('');\n  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);\n  const [clientsList, setClientsList] = useState<{id: string, name: string}[]>([]);"
  );

  // Initialize
  content = content.replace(
    /setEditAssignedTo\(t\.assignedTo \|\| ''\);/,
    "setEditAssignedTo(t.assignedTo || '');\n          setEditProjectId(t.projectId || '');\n          setEditClientId(t.clientId || '');"
  );
  
  // Fetch projects and clients when editing starts (or just on load)
  // Let's do it on load in the fetchTask try block
  content = content.replace(
    /const docSnap = await getDoc\(docRef\);/,
    "const docSnap = await getDoc(docRef);\n        const { getDocs, collection } = await import('firebase/firestore');\n        const pSnap = await getDocs(collection(db, 'projects'));\n        const cSnap = await getDocs(collection(db, 'clients'));\n        setProjectsList(pSnap.docs.map(d => ({id: d.id, name: d.data().name})));\n        setClientsList(cSnap.docs.map(d => ({id: d.id, name: d.data().name})));"
  );

  // Update logic
  content = content.replace(
    /assignedTo: editAssignedTo,/,
    "assignedTo: editAssignedTo,\n        projectId: editProjectId || null,\n        clientId: editClientId || null,"
  );

  // Form Fields
  const projectClientSelectors = `
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Related Project</label>
              <select value={editProjectId} onChange={e => setEditProjectId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                <option value="">None</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Related Client</label>
              <select value={editClientId} onChange={e => setEditClientId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-accent">
                <option value="">None</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
  `;
  
  content = content.replace(
    /<div className="flex justify-end gap-2 mt-6">/,
    projectClientSelectors + '\n          <div className="flex justify-end gap-2 mt-6">'
  );

  fs.writeFileSync('src/pages/TaskDetail.tsx', content);
  console.log('TaskDetail extra edits updated');
} else {
  console.log('Already updated');
}
