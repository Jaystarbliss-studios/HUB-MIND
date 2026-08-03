const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('projectsList')) {
  // Add projectsList and newTaskProject state
  content = content.replace(
    /const \[clientsList, setClientsList\] = useState<\{id: string, name: string\}\[\]>\(\[\]\);/,
    "const [clientsList, setClientsList] = useState<{id: string, name: string}[]>([]);\n  const [projectsList, setProjectsList] = useState<{id: string, name: string}[]>([]);\n  const [newTaskProject, setNewTaskProject] = useState('');"
  );

  // Fetch projectsList inside useEffect
  content = content.replace(
    /const clientsData = clientsSnap\.docs\.map\(doc => \(\{ id: doc\.id, name: doc\.data\(\)\.name \}\)\);/,
    "const clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));\n      const projectsSnap = await getDocs(collection(db, 'projects'));\n      const projectsData = projectsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));\n      setProjectsList(projectsData);"
  );

  // Use newTaskProject in addTask
  content = content.replace(
    /clientId: newTaskClient \|\| null,/,
    "clientId: newTaskClient || null,\n        projectId: newTaskProject || null,"
  );

  // Reset newTaskProject after submit
  content = content.replace(
    /setNewTaskClient\(''\);/,
    "setNewTaskClient('');\n      setNewTaskProject('');"
  );

  // Add project selector in the form UI
  const projectSelector = `
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Related Project (Optional)</label>
              <select 
                value={newTaskProject}
                onChange={(e) => setNewTaskProject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">None</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
  `;
  
  content = content.replace(
    /<div className="md:col-span-2 flex justify-end">/,
    projectSelector + '\n<div className="md:col-span-2 flex justify-end">'
  );

  fs.writeFileSync('src/pages/Tasks.tsx', content);
  console.log('Tasks projects updated');
} else {
  console.log('Already updated');
}
